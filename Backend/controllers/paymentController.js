
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const FinancialLedger = require("../models/FinancialLedger");

const getRazorpayInstance = () => {
  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    throw new Error("Razorpay environment variables are missing");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// CREATE OR REUSE FINANCIAL LEDGER
// Unique bookingId and paymentId constraints prevent duplicate entries.
const ensureFinancialLedger = async (booking, payment) => {
  if (payment.status !== "CAPTURED" || !payment.capturedAt) {
    throw new Error("A captured payment is required for ledger creation");
  }

  if (payment.bookingId.toString() !== booking._id.toString()) {
    throw new Error("Payment does not belong to this booking");
  }

  if (
    payment.amountPaise !== booking.pricePaise ||
    payment.currency !== booking.currency
  ) {
    throw new Error("Payment amount or currency does not match booking");
  }

  const expectedCommission = Math.round(
    (booking.pricePaise * booking.commissionRateBps) / 10000
  );

  if (
    booking.commissionPaise !== expectedCommission ||
    booking.mentorGrossPaise !==
      booking.pricePaise - expectedCommission
  ) {
    throw new Error("Booking financial amounts do not match");
  }

  const existingLedger = await FinancialLedger.findOne({
    $or: [
      { bookingId: booking._id },
      { paymentId: payment._id },
    ],
  });

  if (existingLedger) {
    const sameBooking =
      existingLedger.bookingId.toString() === booking._id.toString();

    const samePayment =
      existingLedger.paymentId.toString() === payment._id.toString();

    if (!sameBooking || !samePayment) {
      throw new Error(
        "Existing ledger has a conflicting booking or payment"
      );
    }

    // Only reconcile dates on an already-confirmed ledger.
    // Do not override review or refund statuses.
    if (existingLedger.status === "CONFIRMED") {
      const updates = {};

      if (
        booking.status === "COMPLETED" &&
        booking.completedAt &&
        booking.payoutEligibleAt
      ) {
        updates.completedAt = booking.completedAt;
        updates.payoutEligibleAt = booking.payoutEligibleAt;
      }

      if (Object.keys(updates).length > 0) {
        await FinancialLedger.updateOne(
          {
            _id: existingLedger._id,
            status: "CONFIRMED",
          },
          { $set: updates }
        );

        return FinancialLedger.findById(existingLedger._id);
      }
    }

    return existingLedger;
  }

  const isConfirmed =
    booking.status === "CONFIRMED" ||
    booking.status === "COMPLETED";

  const ledgerData = {
    bookingId: booking._id,
    paymentId: payment._id,
    currency: payment.currency,
    studentPaidPaise: payment.amountPaise,
    commissionRateBps: booking.commissionRateBps,
    platformCommissionPaise: expectedCommission,
    mentorEarningsPaise:
      booking.pricePaise - expectedCommission,
    status: isConfirmed
      ? "CONFIRMED"
      : "CAPTURED_PENDING_BOOKING",
    capturedAt: payment.capturedAt,
    bookingConfirmedAt: isConfirmed
      ? booking.updatedAt || new Date()
      : null,
    completedAt:
      booking.status === "COMPLETED"
        ? booking.completedAt
        : null,
    payoutEligibleAt:
      booking.status === "COMPLETED"
        ? booking.payoutEligibleAt
        : null,
  };

  try {
    return await FinancialLedger.create(ledgerData);
  } catch (error) {
    // Concurrent verification requests may race on unique indexes.
    if (error.code === 11000) {
      const ledger = await FinancialLedger.findOne({
        $or: [
          { bookingId: booking._id },
          { paymentId: payment._id },
        ],
      });

      if (
        ledger &&
        ledger.bookingId.toString() === booking._id.toString() &&
        ledger.paymentId.toString() === payment._id.toString()
      ) {
        return ledger;
      }

      throw new Error(
        "Duplicate ledger conflict requires reconciliation"
      );
    }

    throw error;
  }
};

// MARK LEDGER FOR REVIEW IF BOOKING CANNOT BE CONFIRMED
const markLedgerForReview = async (bookingId, paymentId, reason) => {
  await FinancialLedger.updateOne(
    {
      bookingId,
      paymentId,
      status: {
        $nin: ["REFUND_PENDING", "REFUNDED"],
      },
    },
    {
      $set: {
        status: "REVIEW_REQUIRED",
        notes: reason,
      },
    }
  );
};

// GET LOGGED-IN STUDENT'S PAYMENTS
const getMyPayments = async (req, res) => {
  try {
    const bookings = await Booking.find({
      studentId: req.user.id,
    }).select("_id");

    const bookingIds = bookings.map((booking) => booking._id);

    const payments = await Payment.find({
      bookingId: { $in: bookingIds },
    })
      .select(
        "bookingId amountPaise currency status capturedAt createdAt"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      payments,
    });
  } catch (error) {
    console.error("Get payments error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch payments",
    });
  }
};

// CREATE OR REUSE RAZORPAY ORDER
const createRazorpayOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !/^[a-f\d]{24}$/i.test(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid bookingId is required",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      studentId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        success: false,
        message: "Booking is not awaiting payment",
      });
    }

    if (booking.holdExpiresAt <= new Date()) {
      await Booking.updateOne(
        {
          _id: booking._id,
          studentId: req.user.id,
          status: "PENDING_PAYMENT",
          holdExpiresAt: { $lte: new Date() },
        },
        {
          $set: { status: "EXPIRED" },
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Booking hold has expired. Please create a new booking.",
      });
    }

    const existingPayment = await Payment.findOne({
      bookingId: booking._id,
      status: "CREATED",
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Existing Razorpay order returned",
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: existingPayment.gatewayOrderId,
        amount: existingPayment.amountPaise,
        currency: existingPayment.currency,
      });
    }

    const razorpay = getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount: booking.pricePaise,
      currency: booking.currency,
      receipt: `booking_${booking._id}`,
    });

    try {
      await Payment.create({
        bookingId: booking._id,
        gateway: "razorpay",
        gatewayOrderId: order.id,
        amountPaise: booking.pricePaise,
        currency: booking.currency,
        status: "CREATED",
      });
    } catch (dbError) {
      console.error("Payment record creation failed:", dbError.message);

      return res.status(500).json({
        success: false,
        message:
          "Order was created but its payment record could not be saved. Contact support before retrying.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Razorpay order created successfully",
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order",
    });
  }
};

// VERIFY RAZORPAY PAYMENT
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !bookingId ||
      !/^[a-f\d]{24}$/i.test(bookingId) ||
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[a-f\d]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid payment verification details are required",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      studentId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const payment = await Payment.findOne({
      bookingId: booking._id,
      gatewayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found for this booking",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "Payment configuration error",
      });
    }

    // Verify Razorpay signature with timing-safe comparison.
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();

    const receivedSignature = Buffer.from(
      razorpay_signature,
      "hex"
    );

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        expectedSignature,
        receivedSignature
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // Confirm actual payment status with Razorpay.
    const razorpay = getRazorpayInstance();

    const providerPayment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      providerPayment.order_id !== razorpay_order_id ||
      providerPayment.amount !== payment.amountPaise ||
      providerPayment.currency !== payment.currency ||
      providerPayment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment is not captured or payment details do not match",
      });
    }

    // Persist the verified capture.
    if (payment.status === "CAPTURED") {
      if (payment.gatewayPaymentId !== razorpay_payment_id) {
        return res.status(409).json({
          success: false,
          message: "A different payment is already recorded",
        });
      }
    } else {
      if (payment.status !== "CREATED") {
        return res.status(409).json({
          success: false,
          message: "Payment is not eligible for verification",
        });
      }

      payment.gatewayPaymentId = razorpay_payment_id;
      payment.status = "CAPTURED";
      payment.capturedAt = new Date();
      payment.rawProviderRefs = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      };

      await payment.save();
    }

    // Create or reuse the ledger after verifying capture.
    await ensureFinancialLedger(booking, payment);

    // A completed booking must remain completed on a retry.
    if (booking.status === "COMPLETED") {
      const ledger = await FinancialLedger.findOne({
        bookingId: booking._id,
        paymentId: payment._id,
      });

      if (!ledger || ledger.status !== "CONFIRMED") {
        return res.status(409).json({
          success: false,
          paymentCaptured: true,
          reconciliationRequired: true,
          ledgerStatus: ledger ? ledger.status : null,
          message:
            "Completed booking ledger requires reconciliation",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        bookingStatus: "COMPLETED",
        paymentStatus: "CAPTURED",
        ledgerStatus: "CONFIRMED",
        ledgerRecorded: true,
      });
    }

    // Idempotent handling for an already-confirmed booking.
    if (booking.status === "CONFIRMED") {
      await FinancialLedger.updateOne(
        {
          bookingId: booking._id,
          paymentId: payment._id,
          status: {
            $nin: ["REFUND_PENDING", "REFUNDED"],
          },
        },
        {
          $set: {
            status: "CONFIRMED",
            bookingConfirmedAt:
              booking.updatedAt || new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        bookingStatus: "CONFIRMED",
        paymentStatus: "CAPTURED",
        ledgerStatus: "CONFIRMED",
        ledgerRecorded: true,
      });
    }

    const now = new Date();

    // Captured payments that cannot confirm their booking
    // must be reviewed; do not automatically refund.
    if (
      booking.status !== "PENDING_PAYMENT" ||
      booking.holdExpiresAt <= now
    ) {
      if (
        booking.status === "PENDING_PAYMENT" &&
        booking.holdExpiresAt <= now
      ) {
        await Booking.updateOne(
          {
            _id: booking._id,
            studentId: req.user.id,
            status: "PENDING_PAYMENT",
            holdExpiresAt: { $lte: new Date() },
          },
          {
            $set: { status: "EXPIRED" },
          }
        );
      }

      await markLedgerForReview(
        booking._id,
        payment._id,
        "Payment captured but booking could not be confirmed. Reconciliation or refund review is required."
      );

      return res.status(409).json({
        success: false,
        paymentCaptured: true,
        paymentStatus: "CAPTURED",
        bookingStatus:
          booking.status === "PENDING_PAYMENT" &&
          booking.holdExpiresAt <= now
            ? "EXPIRED"
            : booking.status,
        ledgerStatus: "REVIEW_REQUIRED",
        message:
          "Payment was captured, but the booking could not be confirmed. Reconciliation or refund review is required.",
      });
    }

    // Atomically confirm only while the hold remains active.
    const confirmedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        studentId: req.user.id,
        status: "PENDING_PAYMENT",
        holdExpiresAt: { $gt: new Date() },
      },
      {
        $set: { status: "CONFIRMED" },
      },
      { new: true }
    );

    if (!confirmedBooking) {
      const latestBooking = await Booking.findById(booking._id);

      if (latestBooking && latestBooking.status === "CONFIRMED") {
        await FinancialLedger.updateOne(
          {
            bookingId: booking._id,
            paymentId: payment._id,
            status: {
              $nin: ["REFUND_PENDING", "REFUNDED"],
            },
          },
          {
            $set: {
              status: "CONFIRMED",
              bookingConfirmedAt:
                latestBooking.updatedAt || new Date(),
            },
          }
        );

        return res.status(200).json({
          success: true,
          message: "Payment was already verified",
          bookingStatus: "CONFIRMED",
          paymentStatus: "CAPTURED",
          ledgerRecorded: true,
        });
      }

      await markLedgerForReview(
        booking._id,
        payment._id,
        "Payment captured but atomic booking confirmation failed. Reconciliation or refund review is required."
      );

      return res.status(409).json({
        success: false,
        paymentCaptured: true,
        paymentStatus: "CAPTURED",
        ledgerStatus: "REVIEW_REQUIRED",
        message:
          "Payment was captured, but booking confirmation failed. Reconciliation or refund review is required.",
      });
    }

    // Update ledger only after booking confirmation succeeds.
    await FinancialLedger.updateOne(
      {
        bookingId: confirmedBooking._id,
        paymentId: payment._id,
        status: {
          $nin: ["REFUND_PENDING", "REFUNDED"],
        },
      },
      {
        $set: {
          status: "CONFIRMED",
          bookingConfirmedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified and booking confirmed",
      bookingStatus: "CONFIRMED",
      paymentStatus: "CAPTURED",
      ledgerStatus: "CONFIRMED",
      ledgerRecorded: true,
    });
  } catch (error) {
    console.error(
      "Verify Razorpay payment error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Verification could not be completed. Check payment status before retrying.",
    });
  }
};

module.exports = {
  getMyPayments,
  createRazorpayOrder,
  verifyRazorpayPayment,
};

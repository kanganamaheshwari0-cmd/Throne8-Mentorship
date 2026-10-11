
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Payment = require("../models/Payment");
const Booking = require("../models/Booking");

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

// GET MY PAYMENTS
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

// CREATE RAZORPAY ORDER
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
        message: "Booking hold has expired. Please create a new booking.",
      });
    }

    // Reuse an existing order for this booking.
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
      console.error(
        "Payment record creation failed:",
        dbError.message
      );

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

    // Validate request data
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

    // Find booking belonging to the logged-in student
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

    // Find the matching Razorpay order
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

    // Verify Razorpay signature
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

    // Verify actual payment status with Razorpay
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

    // If already captured, do not overwrite it
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

      // Save the verified capture first.
      // Never mark a captured payment as FAILED or CREATED.
      payment.gatewayPaymentId = razorpay_payment_id;
      payment.status = "CAPTURED";
      payment.capturedAt = new Date();
      payment.rawProviderRefs = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      };

      await payment.save();
    }

    // Idempotent response if booking is already confirmed
    if (booking.status === "CONFIRMED") {
      return res.status(200).json({
        success: true,
        message: "Payment was already verified",
        bookingStatus: "CONFIRMED",
        paymentStatus: "CAPTURED",
      });
    }

    const now = new Date();

    // Do not confirm expired, cancelled, or otherwise ineligible bookings
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

      return res.status(409).json({
        success: false,
        paymentCaptured: true,
        paymentStatus: "CAPTURED",
        bookingStatus:
          booking.status === "PENDING_PAYMENT" &&
          booking.holdExpiresAt <= now
            ? "EXPIRED"
            : booking.status,
        message:
          "Payment was captured, but the booking could not be confirmed. Reconciliation or refund review is required.",
      });
    }

    // Atomically confirm only if the hold is still active
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
      return res.status(409).json({
        success: false,
        paymentCaptured: true,
        paymentStatus: "CAPTURED",
        message:
          "Payment was captured, but booking confirmation failed. Reconciliation or refund review is required.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and booking confirmed",
      bookingStatus: "CONFIRMED",
      paymentStatus: "CAPTURED",
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

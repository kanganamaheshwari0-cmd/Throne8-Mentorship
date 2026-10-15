
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Refund = require("../models/Refund");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const FinancialLedger = require("../models/FinancialLedger");
const WebhookEvent = require("../models/WebhookEvent");
const { recordWebhookEvent } = require("../services/webhookService");
const {
  tryRecordPaymentCaptured,
} = require("../services/ledgerEntryService");

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
// Validates financial values and safely handles concurrent inserts.
const ensureFinancialLedger = async (booking, payment) => {
  if (payment.status !== "CAPTURED" || !payment.capturedAt) {
    throw new Error(
      "A captured payment is required for ledger creation"
    );
  }

  const sameId = (a, b) =>
    a != null && b != null && String(a) === String(b);

  if (!sameId(payment.bookingId, booking._id)) {
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

  const expectedMentorEarnings =
    booking.pricePaise - expectedCommission;

  if (
    booking.commissionPaise !== expectedCommission ||
    booking.mentorGrossPaise !== expectedMentorEarnings
  ) {
    throw new Error("Booking financial amounts do not match");
  }

  // Validate the ledger identity and all important financial values.
  const validateLedger = (ledger) => {
    if (
      !sameId(ledger.bookingId, booking._id) ||
      !sameId(ledger.paymentId, payment._id)
    ) {
      throw new Error(
        "Existing ledger has a conflicting booking or payment"
      );
    }

    if (
      ledger.currency !== payment.currency ||
      ledger.studentPaidPaise !== payment.amountPaise ||
      ledger.commissionRateBps !== booking.commissionRateBps ||
      ledger.platformCommissionPaise !== expectedCommission ||
      ledger.mentorEarningsPaise !== expectedMentorEarnings
    ) {
      throw new Error(
        "Existing ledger financial values conflict; reconciliation required"
      );
    }

    return ledger;
  };

  const findMatchingLedger = async () =>
    FinancialLedger.findOne({
      $or: [
        { bookingId: booking._id },
        { paymentId: payment._id },
      ],
    });

  const existingLedger = await findMatchingLedger();

  if (existingLedger) {
    validateLedger(existingLedger);

    // Reconcile dates only for an already-confirmed ledger.
    // Never automatically reset review or refund statuses.
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
    mentorEarningsPaise: expectedMentorEarnings,
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
    // A concurrent request may have inserted the ledger first.
    if (error.code === 11000) {
      const ledger = await findMatchingLedger();

      if (!ledger) {
        throw new Error(
          "Duplicate ledger key detected, but no ledger was found; reconciliation required"
        );
      }

      // Reuse only when identity and financial values match.
      return validateLedger(ledger);
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

const handleRazorpayWebhook = async (req, res) => {
  let webhookEvent = null;

  try {
    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Raw webhook body is required",
      });
    }

    if (!signature || !eventId || !webhookSecret) {
      return res.status(400).json({
        success: false,
        message: "Webhook verification configuration is missing",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest();

    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const receivedSignature = Buffer.from(signature, "hex");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Webhook signature verification failed",
      });
    }

    const body = JSON.parse(req.body.toString("utf8"));

    if (typeof body.event !== "string" || !body.event) {
      return res.status(400).json({
        success: false,
        message: "Webhook event type is missing",
      });
    }

    const recorded = await recordWebhookEvent({
      eventId,
      eventType: body.event,
      payload: body,
    });

    webhookEvent = recorded.event;

    if (!webhookEvent) {
      throw new Error("Webhook event record could not be loaded");
    }

    if (
      recorded.duplicate &&
      ["PROCESSED", "PROCESSING"].includes(webhookEvent.status)
    ) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "Webhook event already handled or processing",
      });
    }

    const claimedEvent = await WebhookEvent.findOneAndUpdate(
      {
        _id: webhookEvent._id,
        status: { $in: ["RECEIVED", "FAILED"] },
      },
      {
        $set: {
          status: "PROCESSING",
          errorMessage: null,
        },
      },
      { new: true }
    );

    if (!claimedEvent) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "Webhook event is already being handled",
      });
    }

    webhookEvent = claimedEvent;

    // Handle completed or failed Razorpay refunds.
    if (
      body.event === "refund.processed" ||
      body.event === "refund.failed"
    ) {
      const providerRefund = body.payload?.refund?.entity;

      if (
        !providerRefund ||
        typeof providerRefund.id !== "string" ||
        typeof providerRefund.payment_id !== "string" ||
        !Number.isSafeInteger(providerRefund.amount) ||
        providerRefund.amount <= 0
      ) {
        throw new Error("Refund webhook details are invalid");
      }

      const refundRecord = await Refund.findOne({
        $or: [
          { gatewayRefundId: providerRefund.id },
          { "rawProviderRefs.id": providerRefund.id },
        ],
      });

      if (!refundRecord) {
        throw new Error(
          "Local refund record not found; refund reconciliation required"
        );
      }

      const payment = await Payment.findById(refundRecord.paymentId);

      if (
        !payment ||
        payment.gatewayPaymentId !== providerRefund.payment_id ||
        refundRecord.amountPaise !== providerRefund.amount
      ) {
        throw new Error("Refund does not match the local payment record");
      }

      const booking = await Booking.findById(refundRecord.bookingId);

      if (!booking) {
        throw new Error("Refund booking was not found");
      }

      const ledger = await FinancialLedger.findOne({
        bookingId: booking._id,
        paymentId: payment._id,
      });

      if (!ledger) {
        throw new Error("Refund financial ledger was not found");
      }

      if (body.event === "refund.processed") {
        if (providerRefund.status !== "processed") {
          throw new Error(
            "Provider refund status is not confirmed as processed"
          );
        }

        const previousEntry = payment.refunds.find(
          (item) => item.gatewayRefundId === providerRefund.id
        );

        const alreadyProcessed =
          previousEntry?.status === "PROCESSED" ||
          refundRecord.status === "PROCESSED";

        if (!alreadyProcessed) {
          const currentRefunded =
            Number.isSafeInteger(payment.refundedAmountPaise)
              ? payment.refundedAmountPaise
              : 0;

          const newRefunded =
            currentRefunded + providerRefund.amount;

          if (newRefunded > payment.amountPaise) {
            throw new Error(
              "Total refunds exceed the captured payment amount"
            );
          }

          if (previousEntry) {
            previousEntry.status = "PROCESSED";
            previousEntry.processedAt = new Date();
            previousEntry.amountPaise = providerRefund.amount;
          } else {
            payment.refunds.push({
              gatewayRefundId: providerRefund.id,
              amountPaise: providerRefund.amount,
              status: "PROCESSED",
              processedAt: new Date(),
              rawProviderRefs: {
                id: providerRefund.id,
                payment_id: providerRefund.payment_id,
                status: providerRefund.status,
              },
            });
          }

          payment.refundedAmountPaise = newRefunded;
          payment.status =
            newRefunded === payment.amountPaise
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED";

          await payment.save();
        }

        await Refund.updateOne(
          { _id: refundRecord._id },
          {
            $set: {
              status: "PROCESSED",
              gatewayRefundId: providerRefund.id,
              processedAt: refundRecord.processedAt || new Date(),
              rawProviderRefs: {
                id: providerRefund.id,
                payment_id: providerRefund.payment_id,
                status: providerRefund.status,
              },
              failureReason: null,
            },
          }
        );

        await FinancialLedger.updateOne(
          {
            _id: ledger._id,
            status: {
              $in: [
                "REFUND_PENDING",
                "REVIEW_REQUIRED",
                "REFUNDED",
              ],
            },
          },
          {
            $set: {
              status:
                payment.refundedAmountPaise >= payment.amountPaise
                  ? "REFUNDED"
                  : "REVIEW_REQUIRED",
              notes:
                payment.refundedAmountPaise >= payment.amountPaise
                  ? "Full refund confirmed by verified Razorpay webhook"
                  : "Refund processed; remaining financial balance requires review",
            },
          }
        );
      } else {
        if (providerRefund.status !== "failed") {
          throw new Error(
            "Provider refund status is not confirmed as failed"
          );
        }

        await Refund.updateOne(
          { _id: refundRecord._id },
          {
            $set: {
              status: "FAILED",
              gatewayRefundId: providerRefund.id,
              failureReason: "Razorpay reported refund failure",
              rawProviderRefs: {
                id: providerRefund.id,
                payment_id: providerRefund.payment_id,
                status: providerRefund.status,
              },
            },
          }
        );

        const existingEntry = payment.refunds.find(
          (item) => item.gatewayRefundId === providerRefund.id
        );

        if (existingEntry && existingEntry.status !== "PROCESSED") {
          existingEntry.status = "FAILED";
          existingEntry.rawProviderRefs = {
            id: providerRefund.id,
            payment_id: providerRefund.payment_id,
            status: providerRefund.status,
          };
          await payment.save();
        }

        await FinancialLedger.updateOne(
          {
            _id: ledger._id,
            status: { $ne: "REFUNDED" },
          },
          {
            $set: {
              status: "REVIEW_REQUIRED",
              notes:
                "Razorpay reported refund failure; reconcile before allowing payout",
            },
          }
        );
      }

      await WebhookEvent.updateOne(
        { _id: webhookEvent._id, status: "PROCESSING" },
        {
          $set: {
            status: "PROCESSED",
            processedAt: new Date(),
            errorMessage: null,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Refund webhook processed",
        refundId: refundRecord._id,
      });
    }

    // Acknowledge unrelated event types without changing payment state.
    if (body.event !== "payment.captured") {
      await WebhookEvent.updateOne(
        { _id: webhookEvent._id, status: "PROCESSING" },
        {
          $set: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Webhook event acknowledged",
      });
    }

    const providerPayment = body.payload?.payment?.entity;

    if (
      !providerPayment ||
      typeof providerPayment.id !== "string" ||
      typeof providerPayment.order_id !== "string"
    ) {
      throw new Error("Captured payment details are missing");
    }

    const payment = await Payment.findOne({
      gateway: "razorpay",
      gatewayOrderId: providerPayment.order_id,
    });

    if (!payment) {
      throw new Error("Matching local payment order was not found");
    }

    if (
      providerPayment.amount !== payment.amountPaise ||
      providerPayment.currency !== payment.currency ||
      providerPayment.status !== "captured"
    ) {
      throw new Error("Captured payment details do not match");
    }

    if (
      payment.status === "CAPTURED" &&
      payment.gatewayPaymentId !== providerPayment.id
    ) {
      throw new Error("A different payment is already recorded");
    }

    if (!["CREATED", "CAPTURED"].includes(payment.status)) {
      throw new Error("Local payment is not eligible for capture");
    }

    if (payment.status !== "CAPTURED") {
      payment.gatewayPaymentId = providerPayment.id;
      payment.status = "CAPTURED";
      payment.capturedAt = new Date();
      payment.rawProviderRefs = {
        orderId: providerPayment.order_id,
        paymentId: providerPayment.id,
      };
      await payment.save();
    }

    const booking = await Booking.findById(payment.bookingId);

    if (!booking) {
      throw new Error("Matching booking was not found");
    }

    await ensureFinancialLedger(booking, payment);
    await tryRecordPaymentCaptured({ booking, payment });

    if (
      booking.status === "PENDING_PAYMENT" &&
      booking.holdExpiresAt > new Date()
    ) {
      const confirmedBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: "PENDING_PAYMENT",
          holdExpiresAt: { $gt: new Date() },
        },
        { $set: { status: "CONFIRMED" } },
        { new: true }
      );

      if (confirmedBooking) {
        await FinancialLedger.updateOne(
          {
            bookingId: booking._id,
            paymentId: payment._id,
            status: "CAPTURED_PENDING_BOOKING",
          },
          {
            $set: {
              status: "CONFIRMED",
              bookingConfirmedAt: new Date(),
            },
          }
        );
      } else {
        await markLedgerForReview(
          booking._id,
          payment._id,
          "Captured payment requires booking reconciliation."
        );
      }
    } else if (
      booking.status !== "CONFIRMED" &&
      booking.status !== "COMPLETED"
    ) {
      await markLedgerForReview(
        booking._id,
        payment._id,
        "Captured payment cannot confirm booking automatically; review required."
      );
    }

    await WebhookEvent.updateOne(
      { _id: webhookEvent._id, status: "PROCESSING" },
      {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
          errorMessage: null,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error.message);

    if (webhookEvent) {
      await WebhookEvent.updateOne(
        { _id: webhookEvent._id, status: "PROCESSING" },
        {
          $set: {
            status: "FAILED",
            errorMessage: error.message,
          },
        }
      ).catch((dbError) => {
        console.error("Webhook event update failed:", dbError.message);
      });
    }

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
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

    await ensureFinancialLedger(booking, payment);
    await tryRecordPaymentCaptured({ booking, payment });

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

const getAdminTransactions = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      from = "",
      to = "",
      page = "1",
      limit = "10",
    } = req.query;

    const currentPage = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(currentPage) ||
      currentPage < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const allowedStatuses = [
      "CREATED",
      "AUTHORIZED",
      "CAPTURED",
      "FAILED",
      "PARTIALLY_REFUNDED",
      "REFUNDED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status filter.",
      });
    }

    const dateFilter = {};

    if (from) {
      const fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid from date.",
        });
      }

      dateFilter.$gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid to date.",
        });
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        toDate.setUTCHours(23, 59, 59, 999);
      }

      dateFilter.$lte = toDate;
    }

    if (
      dateFilter.$gte &&
      dateFilter.$lte &&
      dateFilter.$gte > dateFilter.$lte
    ) {
      return res.status(400).json({
        success: false,
        message: "From date must be before the to date.",
      });
    }

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (Object.keys(dateFilter).length) {
      filter.createdAt = dateFilter;
    }

    const term = String(search).trim().slice(0, 120);

    if (term) {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedTerm, "i");
      const matchingBookingIds = [];

      const matchingUsers = await require("../models/User")
        .find({
          $or: [{ name: regex }, { email: regex }],
        })
        .select("_id")
        .limit(200);

      const userIds = matchingUsers.map((user) => user._id);

      if (userIds.length) {
        const studentBookings = await Booking.find({
          studentId: { $in: userIds },
        }).select("_id");

        matchingBookingIds.push(
          ...studentBookings.map((booking) => booking._id)
        );

        const matchingMentors = await require("../models/Mentor")
          .find({ userId: { $in: userIds } })
          .select("_id");

        if (matchingMentors.length) {
          const mentorBookings = await Booking.find({
            mentorId: {
              $in: matchingMentors.map((mentor) => mentor._id),
            },
          }).select("_id");

          matchingBookingIds.push(
            ...mentorBookings.map((booking) => booking._id)
          );
        }
      }

      const matchingBookings = await Booking.find({
        $or: [
          { _id: /^[a-f\d]{24}$/i.test(term) ? term : null },
        ],
      }).select("_id");

      matchingBookingIds.push(
        ...matchingBookings.map((booking) => booking._id)
      );

      const searchConditions = [
        { gatewayOrderId: regex },
        { gatewayPaymentId: regex },
      ];

      if (/^[a-f\d]{24}$/i.test(term)) {
        searchConditions.push({ bookingId: term });
      }

      if (matchingBookingIds.length) {
        searchConditions.push({
          bookingId: { $in: matchingBookingIds },
        });
      }

      filter.$and = [
        {
          $or: searchConditions,
        },
      ];
    }

    const [transactions, total, paymentStats] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: "bookingId",
          select: "studentId mentorId status slotStart slotEnd pricePaise currency",
          populate: [
            {
              path: "studentId",
              select: "name email",
            },
            {
              path: "mentorId",
              select: "userId expertise",
              populate: {
                path: "userId",
                select: "name email",
              },
            },
          ],
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      Payment.countDocuments(filter),

      Payment.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amountPaise: { $sum: "$amountPaise" },
            refundedAmountPaise: { $sum: "$refundedAmountPaise" },
          },
        },
      ]),
    ]);

    const summary = {
      totalTransactions: 0,
      capturedTransactions: 0,
      capturedAmountPaise: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      failedAmountPaise: 0,
      refundedTransactions: 0,
      refundedAmountPaise: 0,
    };

    for (const item of paymentStats) {
      summary.totalTransactions += item.count;

      if (item._id === "CAPTURED") {
        summary.capturedTransactions = item.count;
        summary.capturedAmountPaise = item.amountPaise;
      }

      if (["CREATED", "AUTHORIZED"].includes(item._id)) {
        summary.pendingTransactions += item.count;
      }

      if (item._id === "FAILED") {
        summary.failedTransactions = item.count;
        summary.failedAmountPaise = item.amountPaise;
      }

      if (["PARTIALLY_REFUNDED", "REFUNDED"].includes(item._id)) {
        summary.refundedTransactions += item.count;
        summary.refundedAmountPaise += item.refundedAmountPaise;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Admin transactions fetched successfully",
      summary,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      transactions: transactions.map((payment) => ({
        _id: payment._id,
        bookingId: payment.bookingId?._id || payment.bookingId || null,
        bookingStatus: payment.bookingId?.status || null,
        slotStart: payment.bookingId?.slotStart || null,
        slotEnd: payment.bookingId?.slotEnd || null,
        student: payment.bookingId?.studentId
          ? {
              name: payment.bookingId.studentId.name,
              email: payment.bookingId.studentId.email,
            }
          : null,
        mentor: payment.bookingId?.mentorId?.userId
          ? {
              name: payment.bookingId.mentorId.userId.name,
              email: payment.bookingId.mentorId.userId.email,
              expertise: payment.bookingId.mentorId.expertise || [],
            }
          : null,
        gateway: payment.gateway,
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: payment.gatewayPaymentId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        status: payment.status,
        refundedAmountPaise: payment.refundedAmountPaise || 0,
        refunds: (payment.refunds || []).map((refund) => ({
          gatewayRefundId: refund.gatewayRefundId,
          amountPaise: refund.amountPaise,
          status: refund.status,
          processedAt: refund.processedAt,
        })),
        capturedAt: payment.capturedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get admin transactions error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch admin transactions.",
    });
  }
};

module.exports = {
  getMyPayments,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
  getAdminTransactions,
  ensureFinancialLedger,
};

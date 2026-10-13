
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Refund = require("../models/Refund");
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

const isAdmin = (req) => req.user?.role === "admin";

const validObjectId = (value) =>
  typeof value === "string" &&
  mongoose.isValidObjectId(value);

// Request a refund for a captured Razorpay payment.
// This endpoint does not guarantee atomic coordination with an
// already-running payout approval; payout/refund locking is a
// separate requirement.
const requestRefund = async (req, res) => {
  let refundRecord = null;
  let ledgerLocked = false;

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { paymentId, amountPaise, reason, requestKey } = req.body;

    if (!validObjectId(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid paymentId is required",
      });
    }

    if (
      !Number.isSafeInteger(amountPaise) ||
      amountPaise <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "amountPaise must be a positive whole number",
      });
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 3 ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Reason must contain 3 to 500 characters",
      });
    }

    if (
      typeof requestKey !== "string" ||
      requestKey.trim().length < 8 ||
      requestKey.trim().length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "requestKey must contain 8 to 128 characters",
      });
    }

    const normalizedKey = requestKey.trim();

    // A repeated key must never start another provider refund.
    const existingRefund = await Refund.findOne({
      requestKey: normalizedKey,
    });

    if (existingRefund) {
      return res.status(200).json({
        success: true,
        message: "Refund request already exists; no new refund was sent",
        refund: existingRefund,
        reused: true,
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (
      payment.status !== "CAPTURED" ||
      !payment.gatewayPaymentId
    ) {
      return res.status(409).json({
        success: false,
        message: "A captured Razorpay payment is required",
      });
    }

    const booking = await Booking.findById(payment.bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking associated with payment was not found",
      });
    }

    if (
      !Number.isSafeInteger(payment.amountPaise) ||
      payment.amountPaise <= 0 ||
      payment.currency !== "INR"
    ) {
      return res.status(409).json({
        success: false,
        message: "Payment amount or currency is invalid",
      });
    }

    const ledger = await FinancialLedger.findOne({
      bookingId: booking._id,
      paymentId: payment._id,
    });

    if (!ledger || ledger.status !== "CONFIRMED") {
      return res.status(409).json({
        success: false,
        message:
          "A confirmed ledger is required. This booking may already be under financial review.",
      });
    }

    if (
      amountPaise > payment.amountPaise ||
      amountPaise !== payment.amountPaise
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This controller currently supports full refunds only; amountPaise must equal the captured payment amount",
      });
    }

    // Keep this first version conservative: only one refund workflow
    // can reserve a confirmed ledger at a time.
    const lockedLedger = await FinancialLedger.findOneAndUpdate(
      {
        _id: ledger._id,
        status: "CONFIRMED",
      },
      {
        $set: {
          status: "REFUND_PENDING",
          notes: "Refund request reserved; provider confirmation pending",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!lockedLedger) {
      return res.status(409).json({
        success: false,
        message: "Ledger state changed; refresh and review the booking",
      });
    }

    ledgerLocked = true;

    refundRecord = await Refund.create({
      paymentId: payment._id,
      bookingId: booking._id,
      requestKey: normalizedKey,
      requestedBy: req.user.id,
      amountPaise,
      currency: "INR",
      reason: reason.trim(),
      status: "REQUESTED",
    });

    // Send the refund only after reserving the ledger.
    const razorpay = getRazorpayInstance();

    await Refund.updateOne(
      {
        _id: refundRecord._id,
        status: "REQUESTED",
      },
      {
        $set: { status: "PROCESSING" },
      }
    );

    refundRecord.status = "PROCESSING";

    let providerRefund;

    try {
      providerRefund = await razorpay.payments.refund(
        payment.gatewayPaymentId,
        {
          amount: amountPaise,
          notes: {
            localRefundId: refundRecord._id.toString(),
            requestKey: normalizedKey,
            bookingId: booking._id.toString(),
          },
        }
      );
    } catch (providerError) {
      // A network/provider error can be ambiguous: Razorpay may have
      // accepted the request even if the response did not reach us.
      // Keep the ledger blocked and require reconciliation.
      await Refund.updateOne(
        {
          _id: refundRecord._id,
          status: "PROCESSING",
        },
        {
          $set: {
            status: "RECONCILIATION_REQUIRED",
            failureReason:
              "Provider result is uncertain; reconcile with Razorpay before retrying",
            notes: "Do not automatically retry this refund",
          },
        }
      );

      await FinancialLedger.updateOne(
        {
          _id: ledger._id,
          status: "REFUND_PENDING",
        },
        {
          $set: {
            status: "REVIEW_REQUIRED",
            notes:
              "Razorpay refund result uncertain; manual reconciliation required",
          },
        }
      );

      return res.status(202).json({
        success: false,
        message:
          "Refund result is uncertain. Do not retry with a new request key; reconcile the Razorpay payment first.",
        refundId: refundRecord._id,
        reconciliationRequired: true,
      });
    }

    const updatedRefund = await Refund.findOneAndUpdate(
      {
        _id: refundRecord._id,
        status: "PROCESSING",
      },
      {
        $set: {
          gatewayRefundId: providerRefund.id,
          rawProviderRefs: {
            id: providerRefund.id,
            status: providerRefund.status,
            payment_id: providerRefund.payment_id,
          },
          notes:
            "Provider accepted the refund request; awaiting confirmed final status",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // A successful API response means accepted, not necessarily
    // finally processed. The verified webhook/reconciliation flow
    // must confirm the final state.
    return res.status(202).json({
      success: true,
      message:
        "Refund submitted to Razorpay; final status must be confirmed",
      refund: updatedRefund,
      providerStatus: providerRefund.status,
      note:
        "The ledger remains blocked. Do not mark this refund complete until verified provider confirmation.",
    });
  } catch (error) {
    console.error("Request refund error:", error.message);

    // If a local refund record exists, do not release the ledger
    // automatically: the provider may already have received a request.
    if (refundRecord && ledgerLocked) {
      await Refund.updateOne(
        {
          _id: refundRecord._id,
          status: { $in: ["REQUESTED", "PROCESSING"] },
        },
        {
          $set: {
            status: "RECONCILIATION_REQUIRED",
            failureReason:
              "Unexpected error after reserving the refund workflow",
          },
        }
      ).catch((dbError) => {
        console.error(
          "Refund reconciliation update failed:",
          dbError.message
        );
      });

      await FinancialLedger.updateOne(
        {
          bookingId: refundRecord.bookingId,
          status: "REFUND_PENDING",
        },
        {
          $set: {
            status: "REVIEW_REQUIRED",
            notes: "Unexpected refund error; reconciliation required",
          },
        }
      ).catch((dbError) => {
        console.error(
          "Ledger review update failed:",
          dbError.message
        );
      });
    }

    if (error.code === 11000) {
      const duplicate = await Refund.findOne({
        requestKey:
          typeof req.body?.requestKey === "string"
            ? req.body.requestKey.trim()
            : "",
      });

      if (duplicate) {
        return res.status(200).json({
          success: true,
          message: "Refund request already exists",
          refund: duplicate,
          reused: true,
        });
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to complete refund request. Check refund and ledger records before retrying.",
    });
  }
};

// Admin-only list for monitoring and reconciliation.
const getAdminRefunds = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const refunds = await Refund.find()
      .populate("paymentId", "gatewayPaymentId amountPaise currency status")
      .populate("bookingId", "status completedAt")
      .populate("requestedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      totalRefunds: refunds.length,
      refunds,
    });
  } catch (error) {
    console.error("Get admin refunds error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch refunds",
    });
  }
};

module.exports = {
  requestRefund,
  getAdminRefunds,
};

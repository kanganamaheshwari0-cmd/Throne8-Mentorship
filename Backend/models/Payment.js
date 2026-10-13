const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    gatewayRefundId: {
      type: String,
      required: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Refund amount must be a whole number of paise.",
      },
    },

    status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: "PENDING",
      required: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    rawProviderRefs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    gateway: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      required: true,
    },

    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    gatewayPaymentId: {
      type: String,
      default: null,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amount must be a whole number of paise.",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },

    status: {
      type: String,
      enum: [
        "CREATED",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
      ],
      default: "CREATED",
      index: true,
    },

    capturedAt: {
      type: Date,
      default: null,
    },

    refundedAmountPaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Refunded amount must be a whole number of paise.",
      },
    },

    refunds: {
      type: [refundSchema],
      default: [],
    },

    rawProviderRefs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

paymentSchema.index(
  { gatewayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      gatewayPaymentId: { $type: "string" },
    },
  }
);

// Prevent the same Razorpay refund ID from being stored twice
// within a single payment document.
paymentSchema.path("refunds").validate(function (refunds) {
  const refundIds = refunds.map((refund) => refund.gatewayRefundId);
  return new Set(refundIds).size === refundIds.length;
}, "Duplicate refund ID found for this payment.");

module.exports = mongoose.model("Payment", paymentSchema);

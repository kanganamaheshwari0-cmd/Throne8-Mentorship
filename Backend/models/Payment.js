
const mongoose = require("mongoose");

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

    rawProviderRefs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
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

module.exports = mongoose.model("Payment", paymentSchema);
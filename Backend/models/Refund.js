
const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    providerRefundId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
      ],
      default: "REQUESTED",
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

refundSchema.index({
  paymentId: 1,
  status: 1,
});

refundSchema.index(
  { providerRefundId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerRefundId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Refund", refundSchema);
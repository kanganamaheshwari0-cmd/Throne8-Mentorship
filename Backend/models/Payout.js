const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      index: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payout amount must be a whole number in paise.",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "PROCESSING",
        "PAID",
        "FAILED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },

    payoutEligibleAt: {
      type: Date,
      required: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    gateway: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
    },

    gatewayPayoutId: {
      type: String,
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

payoutSchema.index({
  mentorId: 1,
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Payout", payoutSchema);

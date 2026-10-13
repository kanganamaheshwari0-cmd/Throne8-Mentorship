const mongoose = require("mongoose");

const financialLedgerSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
      index: true,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    studentPaidPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Student payment must be a whole number in paise.",
      },
    },

    commissionRateBps: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      validate: {
        validator: Number.isSafeInteger,
        message: "Commission rate must be a whole number.",
      },
    },

    platformCommissionPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Platform commission must be a whole number in paise.",
      },
    },

    mentorEarningsPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Mentor earnings must be a whole number in paise.",
      },
    },

    status: {
      type: String,
      enum: [
        "CAPTURED_PENDING_BOOKING",
        "CONFIRMED",
        "REVIEW_REQUIRED",
        "REFUND_PENDING",
        "REFUNDED",
      ],
      default: "CAPTURED_PENDING_BOOKING",
      required: true,
      index: true,
    },

    capturedAt: {
      type: Date,
      required: true,
    },

    bookingConfirmedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    payoutEligibleAt: {
      type: Date,
      default: null,
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

financialLedgerSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model(
  "FinancialLedger",
  financialLedgerSchema
);

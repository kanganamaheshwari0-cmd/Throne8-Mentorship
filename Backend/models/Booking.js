const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      index: true,
    },

    slotStart: {
      type: Date,
      required: true,
    },

    slotEnd: {
      type: Date,
      required: true,
    },

    pricePaise: {
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
        "PENDING_PAYMENT",
        "CONFIRMED",
        "COMPLETED",
        "EXPIRED",
        "CANCELLED",
        "DISPUTED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },

    holdExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    commissionRateBps: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },

    commissionPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    mentorGrossPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    payoutEligibleAt: {
      type: Date,
      default: null,
    },

    // ---- Session completion review (mentor requests, admin verifies) ----
    completionReviewStatus: {
      type: String,
      enum: ["NONE", "REQUESTED", "REJECTED", "VERIFIED"],
      default: "NONE",
      index: true,
    },

    completionRequestedAt: {
      type: Date,
      default: null,
    },

    completionRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    completionEvidenceUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    completionVerifiedAt: {
      type: Date,
      default: null,
    },

    completionVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completionRejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({
  studentId: 1,
  createdAt: -1,
});

bookingSchema.index({
  status: 1,
  payoutEligibleAt: 1,
});

bookingSchema.index({
  status: 1,
  completionReviewStatus: 1,
  completionRequestedAt: 1,
});

module.exports = mongoose.model("Booking", bookingSchema);
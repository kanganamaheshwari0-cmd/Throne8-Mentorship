
const mongoose = require("mongoose");

const mentorAccountSchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      unique: true,
    },

    accountHolderName: {
      type: String,
      trim: true,
      default: null,
    },

    payoutMethod: {
      type: String,
      enum: ["razorpay", "bank_transfer"],
      default: "razorpay",
    },

    providerAccountId: {
      type: String,
      default: null,
    },

    verificationStatus: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    payoutEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    disabledReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

mentorAccountSchema.index({
  verificationStatus: 1,
  payoutEnabled: 1,
});

module.exports = mongoose.model(
  "MentorAccount",
  mentorAccountSchema
);
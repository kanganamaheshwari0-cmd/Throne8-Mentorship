
const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    earningId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Earning",
      required: true,
    },

    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      index: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    providerTransferId: {
      type: String,
      default: null,
    },

    attempt: {
      type: Number,
      default: 1,
      min: 1,
    },

    state: {
      type: String,
      enum: [
        "QUEUED",
        "INITIATED",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
      ],
      default: "QUEUED",
      index: true,
    },

    initiatedAt: {
      type: Date,
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    failureCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payoutSchema.index(
  { earningId: 1 },
  { unique: true }
);

payoutSchema.index(
  { providerTransferId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerTransferId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Payout", payoutSchema);
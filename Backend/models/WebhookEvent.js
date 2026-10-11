
const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    gateway: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      required: true,
    },

    eventId: {
      type: String,
      required: true,
    },

    eventType: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"],
      default: "RECEIVED",
      index: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    processedAt: {
      type: Date,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

webhookEventSchema.index(
  { gateway: 1, eventId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "WebhookEvent",
  webhookEventSchema
);
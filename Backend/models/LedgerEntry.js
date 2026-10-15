
const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: ["PAYMENT_CAPTURED", "REFUND_SUCCEEDED"],
      required: true,
      index: true,
    },

    account: {
      type: String,
      enum: [
        "GATEWAY_CLEARING",
        "PLATFORM_COMMISSION",
        "MENTOR_PAYABLE",
        "REFUND_CLEARING",
      ],
      required: true,
    },

    direction: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Amount must be a whole number in paise.",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    eventKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ledgerEntrySchema.index({
  bookingId: 1,
  eventType: 1,
});

ledgerEntrySchema.index({
  paymentId: 1,
  eventType: 1,
});

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);

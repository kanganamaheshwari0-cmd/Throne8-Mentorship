const crypto = require("crypto");
const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    entryId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    eventType: {
      type: String,
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
        "MENTOR_PAYOUT_CLEARING",
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
        message: "Ledger amount must be a whole number in paise.",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    // Same financial event dobara aaye to duplicate entry nahi banegi.
    eventKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

ledgerEntrySchema.index({ bookingId: 1, createdAt: 1 });

// Ledger entries kabhi edit ya delete nahi hongi.
// Refund/correction ke liye ulti (reversing) entry banegi.
const blockChange = async function () {
  throw new Error("Ledger entries are immutable");
};

ledgerEntrySchema.pre("save", async function () {
  if (!this.isNew) {
    throw new Error("Ledger entries are immutable");
  }
});

[
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
].forEach((hook) => {
  ledgerEntrySchema.pre(hook, blockChange);
});

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
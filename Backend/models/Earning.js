const mongoose = require("mongoose");

const earningSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
      index: true,
    },

    grossPaise: {
      type: Number,
      required: true,
      min: 1,
    },

    commissionPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    payablePaise: {
      type: Number,
      required: true,
      min: 0,
    },

    eligibleAt: {
      type: Date,
      required: true,
      index: true,
    },

    state: {
      type: String,
      enum: [
        "PENDING_SESSION",
        "HOLDING",
        "ELIGIBLE",
        "PROCESSING",
        "PAID",
        "ON_HOLD",
        "REVERSED",
      ],
      default: "PENDING_SESSION",
      index: true,
    },

    holdReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

earningSchema.index({
  state: 1,
  eligibleAt: 1,
});

module.exports = mongoose.model("Earning", earningSchema);

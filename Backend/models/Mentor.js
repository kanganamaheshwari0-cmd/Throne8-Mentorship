
const mongoose = require("mongoose");

const mentorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    expertise: {
      type: [String],
      default: [],
    },

    sessionPricePaise: {
      type: Number,
      required: true,
      min: 1,
    },

    commissionRateBps: {
      type: Number,
      default: 2000,
      min: 0,
      max: 10000,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Mentor", mentorSchema);
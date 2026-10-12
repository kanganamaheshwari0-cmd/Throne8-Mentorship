
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
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
        },
      ],
      default: [],
      validate: {
        validator: function (items) {
          return (
            Array.isArray(items) &&
            items.every(
              (item) =>
                typeof item === "string" &&
                item.trim().length > 0
            )
          );
        },
        message: "Expertise cannot contain empty values.",
      },
    },

    sessionPricePaise: {
      type: Number,
      required: true,
      min: [1, "Session price must be greater than zero."],
      validate: {
        validator: function (value) {
          return (
            Number.isSafeInteger(value) &&
            value > 0
          );
        },
        message:
          "Session price must be a positive whole number in paise.",
      },
    },

    commissionRateBps: {
      type: Number,
      required: true,
      default: 2000,
      min: [0, "Commission cannot be negative."],
      max: [10000, "Commission cannot exceed 100%."],
      validate: {
        validator: function (value) {
          return (
            Number.isSafeInteger(value) &&
            value >= 0 &&
            value <= 10000
          );
        },
        message:
          "Commission must be a whole number between 0 and 10000 basis points.",
      },
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    bookingLockToken: {
      type: String,
      default: null,
    },

    bookingLockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Mentor", mentorSchema);

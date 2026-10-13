const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    actorRole: {
      type: String,
      default: null,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      required: true,
    },

    targetId: {
      type: String,
      required: true,
    },

    // Sirf safe fields daalo. Password, token, secret kabhi nahi.
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    requestId: {
      type: String,
      default: null,
    },

    ip: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

auditLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });

// Audit logs sirf add hote hain, kabhi edit ya delete nahi.
const blockChange = async function () {
  throw new Error("Audit logs are immutable");
};

auditLogSchema.pre("save", async function () {
  if (!this.isNew) {
    throw new Error("Audit logs are immutable");
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
  auditLogSchema.pre(hook, blockChange);
});

module.exports = mongoose.model("AuditLog", auditLogSchema);

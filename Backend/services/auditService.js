const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

const SENSITIVE_KEYS =
  /password|token|secret|authorization|cookie|api.?key|signature/i;

const sanitize = (value, depth = 0) => {
  if (value == null) return value;
  if (depth > 5) return "[MAX_DEPTH]";
  if (value instanceof Date) return value;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === "object") {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.test(key)
        ? "[REDACTED]"
        : sanitize(item, depth + 1);
    }

    return result;
  }

  if (typeof value === "string") {
    return value.length > 2000 ? value.slice(0, 2000) : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
};

const logAudit = async ({
  req = null,
  actorId = null,
  actorRole = null,
  action,
  targetType,
  targetId,
  before = null,
  after = null,
  meta = null,
}) => {
  if (!action || !targetType || targetId == null) {
    throw new Error(
      "Audit action, targetType and targetId are required"
    );
  }

  const user = req?.user || {};

  return AuditLog.create({
    actorId: actorId || user.id || user._id || null,
    actorRole: actorRole || user.role || null,
    action: String(action).slice(0, 150),
    targetType: String(targetType).slice(0, 100),
    targetId: String(targetId).slice(0, 200),
    before: sanitize(before),
    after: sanitize(after),
    meta: sanitize(meta),
    requestId:
      typeof req?.requestId === "string"
        ? req.requestId.slice(0, 150)
        : null,
    ip:
      typeof req?.ip === "string"
        ? req.ip.slice(0, 100)
        : null,
    timestamp: new Date(),
  });
};

module.exports = { logAudit };
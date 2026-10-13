const mongoose = require("mongoose");

const AuditLog = require("../models/AuditLog");
const LedgerEntry = require("../models/LedgerEntry");

const toLimit = (value, fallback = 50) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 100);
};

// GET /api/v1/admin/audit-logs?action=&targetType=&targetId=&page=1&limit=50
const getAuditLogs = async (req, res) => {
  try {
    const filter = {};

    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.targetType) filter.targetType = String(req.query.targetType);
    if (req.query.targetId) filter.targetId = String(req.query.targetId);

    const limit = toLimit(req.query.limit);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actorId", "name email role")
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch audit logs",
    });
  }
};

// GET /api/v1/admin/ledger-entries?bookingId=&page=1&limit=50
const getLedgerEntries = async (req, res) => {
  try {
    const filter = {};

    if (req.query.bookingId) {
      if (!mongoose.isValidObjectId(req.query.bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bookingId",
        });
      }

      filter.bookingId = req.query.bookingId;
    }

    const limit = toLimit(req.query.limit);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [entries, total] = await Promise.all([
      LedgerEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LedgerEntry.countDocuments(filter),
    ]);

    const debitPaise = entries
      .filter((e) => e.direction === "DEBIT")
      .reduce((sum, e) => sum + e.amountPaise, 0);

    const creditPaise = entries
      .filter((e) => e.direction === "CREDIT")
      .reduce((sum, e) => sum + e.amountPaise, 0);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      // Sirf is page ke entries ka total. Ek booking filter par debit = credit hona chahiye.
      pageTotals: { debitPaise, creditPaise },
      entries,
    });
  } catch (error) {
    console.error("Get ledger entries error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch ledger entries",
    });
  }
};

module.exports = { getAuditLogs, getLedgerEntries };

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  verifyMentor,
  updateMentorCommission,
  getAdminStats,
} = require("../controllers/adminController");

const {
  getAdminPayouts,
  getAdminFinanceSummary,
  generateEligiblePayouts,
  approvePayout,
} = require("../controllers/payoutController");

const {
  getAuditLogs,
  getLedgerEntries,
} = require("../controllers/auditController");

const {
  requestRefund,
  getAdminRefunds,
} = require("../controllers/refundController");

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin account required.",
    });
  }

  next();
};

router.use(authMiddleware, adminOnly);

// Mentor management
router.get("/mentors", getAllMentors);
router.get("/stats", getAdminStats);
router.patch("/mentors/:mentorId/verify", verifyMentor);
router.patch("/mentors/:mentorId/commission", updateMentorCommission);

// Payout and finance management
router.get("/payouts", getAdminPayouts);
router.get("/finance-summary", getAdminFinanceSummary);
router.post("/payouts/generate", generateEligiblePayouts);
router.patch("/payouts/:payoutId/approve", approvePayout);

// Refund management
router.get("/refunds", getAdminRefunds);
router.post("/refunds", requestRefund);

// Audit trail and ledger
router.get("/audit-logs", getAuditLogs);
router.get("/ledger-entries", getLedgerEntries);

module.exports = router;

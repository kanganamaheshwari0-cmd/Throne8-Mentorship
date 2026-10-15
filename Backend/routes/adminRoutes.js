
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  verifyMentor,
  updateMentorCommission,
  getCommissionOverview,
  getCommissionRecords,
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

const {
  getAdminTransactions,
} = require("../controllers/paymentController");

const {
  getAdminReconciliation,
} = require("../controllers/reconciliationController");

const {
  repairMissingFinancialLedgers,
} = require("../controllers/financialLedgerRepairController");

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
router.get("/commission-overview", getCommissionOverview);
router.get("/commission-records", getCommissionRecords);

router.get("/transactions", getAdminTransactions);

// Read-only financial reconciliation
router.get("/reconciliation", getAdminReconciliation);

router.post(
  "/reconciliation/repair",
  repairMissingFinancialLedgers
);

module.exports = router;


const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  verifyMentor,
  getAdminStats,
} = require("../controllers/adminController");

const {
  getAdminPayouts,
  generateEligiblePayouts,
  approvePayout,
} = require("../controllers/payoutController");

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin account required.",
    });
  }

  next();
};

// All admin routes require authentication and admin role.
router.use(authMiddleware, adminOnly);

// Mentor management
router.get("/mentors", getAllMentors);
router.get("/stats", getAdminStats);

router.patch(
  "/mentors/:mentorId/verify",
  verifyMentor
);

// Payout management
router.get("/payouts", getAdminPayouts);

router.post(
  "/payouts/generate",
  generateEligiblePayouts
);

router.patch(
  "/payouts/:payoutId/approve",
  approvePayout
);

module.exports = router;

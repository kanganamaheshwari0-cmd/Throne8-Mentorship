
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  verifyMentor,
  getAdminStats,
} = require("../controllers/adminController");

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin account required.",
    });
  }

  next();
};

// Get all mentors for admin
router.get(
  "/mentors",
  authMiddleware,
  adminOnly,
  getAllMentors
);

// Get admin dashboard statistics
router.get("/stats", authMiddleware, adminOnly, getAdminStats);

// Verify mentor
router.patch(
  "/mentors/:mentorId/verify",
  authMiddleware,
  adminOnly,
  verifyMentor
);

module.exports = router;

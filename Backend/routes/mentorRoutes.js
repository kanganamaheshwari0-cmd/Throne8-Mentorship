const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  getMyMentorProfile,
  updateMyMentorProfile,
  getMyMentorBookings,
  getMyMentorEarnings,
} = require("../controllers/mentorController");

// Check mentor role
const mentorOnly = (req, res, next) => {
  if (req.user.role !== "mentor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Mentor account required.",
    });
  }

  next();
};

// Get all verified mentors
router.get("/", getAllMentors);

// Get mentor profile
router.get(
  "/me",
  authMiddleware,
  mentorOnly,
  getMyMentorProfile
);

// Update mentor profile
router.patch(
  "/me",
  authMiddleware,
  mentorOnly,
  updateMyMentorProfile
);

// Get mentor bookings
router.get(
  "/my-bookings",
  authMiddleware,
  mentorOnly,
  getMyMentorBookings
);

// Get mentor earnings and payout history
router.get(
  "/earnings",
  authMiddleware,
  mentorOnly,
  getMyMentorEarnings
);

module.exports = router;
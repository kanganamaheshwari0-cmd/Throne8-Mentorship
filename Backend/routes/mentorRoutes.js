const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllMentors,
  getMyMentorProfile,
  updateMyMentorProfile,
  getMyMentorBookings,
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

// Get mentor profile
router.get("/me", authMiddleware, mentorOnly, getMyMentorProfile);

//get all mentor
router.get("/", getAllMentors);

// Update mentor profile
router.patch("/me", authMiddleware, mentorOnly, updateMyMentorProfile);

router.get( "/my-bookings", authMiddleware, mentorOnly, getMyMentorBookings);

module.exports = router;
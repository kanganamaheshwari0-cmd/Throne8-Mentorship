
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createBooking,
  getMyBookings,
  getMentorBookings,
  completeMentorBooking,
} = require("../controllers/bookingController");

// Get logged-in student's bookings
router.get("/my", authMiddleware, getMyBookings);

// Create a mentorship booking
router.post("/", authMiddleware, createBooking);

// Get logged-in mentor's bookings
router.get("/mentor", authMiddleware, getMentorBookings);

// Complete a confirmed booking (mentor only)
router.patch(
  "/:bookingId/complete",
  authMiddleware,
  completeMentorBooking
);

module.exports = router;

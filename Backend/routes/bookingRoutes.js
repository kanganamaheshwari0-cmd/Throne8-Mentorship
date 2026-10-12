
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createBooking,
  getMyBookings,
  completeMentorBooking,
} = require("../controllers/bookingController");

// Get logged-in student's bookings
router.get("/my", authMiddleware, getMyBookings);

// Create a mentorship booking
router.post("/", authMiddleware, createBooking);

// Complete a confirmed booking (mentor only)
router.patch(
  "/:bookingId/complete",
  authMiddleware,
  completeMentorBooking
);

module.exports = router;

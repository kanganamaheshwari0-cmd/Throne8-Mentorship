
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createBooking,
  getMyBookings,
} = require("../controllers/bookingController");

// Get logged-in student's bookings
router.get("/my", authMiddleware, getMyBookings);

// Create a mentorship booking
router.post("/", authMiddleware, createBooking);

module.exports = router;

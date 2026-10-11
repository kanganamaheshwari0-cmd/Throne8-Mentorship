
const express = require("express");
const router = express.Router();

const {
  getMyPayments,
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require("../controllers/paymentController");

const authMiddleware = require("../middleware/authMiddleware");

// Get logged-in student's payments
router.get("/my", authMiddleware, getMyPayments);

// Create Razorpay order for a booking
router.post("/create-order", authMiddleware, createRazorpayOrder);

// Verify Razorpay payment
router.post("/verify", authMiddleware, verifyRazorpayPayment);

module.exports = router;

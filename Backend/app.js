
const express = require("express");
const cors = require("cors");

const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const financialLedgerRoutes = require("./routes/financialLedgerRoutes");

const {
  handleRazorpayWebhook,
} = require("./controllers/paymentController");

const app = express();

// CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Razorpay webhook MUST come before express.json()
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook
);

// Normal request body parsing
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/mentors", mentorRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/financial-ledger", financialLedgerRoutes);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "THRONE8 Mentorship API is running",
  });
});

// Health check
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is working",
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;

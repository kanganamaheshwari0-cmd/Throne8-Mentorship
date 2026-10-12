const express = require("express");
const cors = require("cors");

const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const financialLedgerRoutes = require("./routes/financialLedgerRoutes");

const app = express();

app.use(
cors({
origin: "http://localhost:5173",
credentials: true,
})
);

// app.use(express.json());

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

// Payment routes
app.use("/api/v1/payments", paymentRoutes);

// Authentication routes
app.use("/api/v1/auth", authRoutes);

// Booking routes
app.use("/api/v1/bookings", bookingRoutes);

// Mentor routes
app.use("/api/v1/mentors", mentorRoutes);
// app.use("/api/v1/mentors", require("./Routes/mentorRoutes"));

//admin routes
app.use("/api/v1/admin", adminRoutes);

app.use("/api/v1/financial-ledger", financialLedgerRoutes);

app.get("/", (req, res) => {
res.status(200).json({
success: true,
message: "THRONE8 Mentorship API is running",
});
});

app.get("/api/v1/health", (req, res) => {
res.status(200).json({
success: true,
message: "API is working",
timestamp: new Date().toISOString(),
});
});

module.exports = app;
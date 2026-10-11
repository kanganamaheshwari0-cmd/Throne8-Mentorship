const express = require("express");
const cors = require("cors");

const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const mentorRoutes = require("./routes/mentorRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(
cors({
origin: "http://localhost:5173",
credentials: true,
})
);

app.use(express.json());

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
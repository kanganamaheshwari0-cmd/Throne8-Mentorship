
const Mentor = require("../models/Mentor");
const Booking = require("../models/Booking");

// Get all verified mentors for students
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find({ isVerified: true })
      .select("expertise sessionPricePaise isVerified createdAt userId")
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Verified mentors fetched successfully",
      totalMentors: mentors.length,
      mentors,
    });
  } catch (error) {
    console.error("Fetch all mentors error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentors",
    });
  }
};

// Get logged-in mentor's profile
const getMyMentorProfile = async (req, res) => {
  try {
    const mentor = await Mentor.findOne({
      userId: req.user.id,
    }).populate("userId", "name email role");

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mentor profile fetched successfully",
      mentor,
    });
  } catch (error) {
    console.error("Fetch mentor profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor profile",
    });
  }
};

// Update logged-in mentor's profile
const updateMyMentorProfile = async (req, res) => {
  try {
    const { expertise, sessionPricePaise } = req.body;

    if (
      expertise !== undefined &&
      (!Array.isArray(expertise) ||
        !expertise.every(
          (item) =>
            typeof item === "string" && item.trim().length > 0
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Expertise must be an array of non-empty strings",
      });
    }

    if (
      sessionPricePaise !== undefined &&
      (!Number.isSafeInteger(sessionPricePaise) ||
        sessionPricePaise <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Session price must be a positive integer in paise",
      });
    }

    if (
      expertise === undefined &&
      sessionPricePaise === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide expertise or sessionPricePaise to update",
      });
    }

    const updates = {};

    if (expertise !== undefined) {
      updates.expertise = [
        ...new Set(expertise.map((item) => item.trim())),
      ];
    }

    if (sessionPricePaise !== undefined) {
      updates.sessionPricePaise = sessionPricePaise;
    }

    const mentor = await Mentor.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("userId", "name email role");

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mentor profile updated successfully",
      mentor,
    });
  } catch (error) {
    console.error("Update mentor profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update mentor profile",
    });
  }
};

// Get bookings for the logged-in mentor only
const getMyMentorBookings = async (req, res) => {
  try {
    const mentor = await Mentor.findOne({
      userId: req.user.id,
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    const bookings = await Booking.find({
      mentorId: mentor._id,
    })
      .populate("studentId", "name email")
      .sort({ slotStart: -1 });

    return res.status(200).json({
      success: true,
      message: "Mentor bookings fetched successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Fetch mentor bookings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor bookings",
    });
  }
};

module.exports = {
  getAllMentors,
  getMyMentorProfile,
  updateMyMentorProfile,
  getMyMentorBookings,
};

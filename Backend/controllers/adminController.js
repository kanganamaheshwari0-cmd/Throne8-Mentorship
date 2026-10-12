
const User = require("../models/User");
const Mentor = require("../models/Mentor");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

// GET ALL MENTORS FOR ADMIN
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Mentors fetched successfully",
      totalMentors: mentors.length,
      mentors,
    });
  } catch (error) {
    console.error("Get all mentors error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch mentors",
    });
  }
};

// VERIFY MENTOR
const verifyMentor = async (req, res) => {
  try {
    const { mentorId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(mentorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mentor ID",
      });
    }

    const mentor = await Mentor.findById(mentorId);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    mentor.isVerified = true;
    await mentor.save();

    return res.status(200).json({
      success: true,
      message: "Mentor verified successfully",
      mentor: {
        id: mentor._id,
        userId: mentor.userId,
        isVerified: mentor.isVerified,
      },
    });
  } catch (error) {
    console.error("Verify mentor error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify mentor",
    });
  }
};

// ADMIN DASHBOARD STATISTICS
const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalMentors,
      verifiedMentors,
      totalBookings,
      confirmedBookings,
      completedBookings,
      totalPayments,
      capturedPayments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      Mentor.countDocuments(),
      Mentor.countDocuments({ isVerified: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "CONFIRMED" }),
      Booking.countDocuments({ status: "COMPLETED" }),
      Payment.countDocuments(),
      Payment.find({ status: "CAPTURED" }).select("amountPaise"),
    ]);

    const totalRevenuePaise = capturedPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.amountPaise || 0),
      0
    );

    return res.status(200).json({
      success: true,
      message: "Admin dashboard statistics fetched successfully",
      stats: {
        totalUsers,
        totalStudents,
        totalMentors,
        verifiedMentors,
        pendingMentorVerifications: Math.max(
          0,
          totalMentors - verifiedMentors
        ),
        totalBookings,
        confirmedBookings,
        completedBookings,
        totalPayments,
        capturedPayments: capturedPayments.length,
        totalRevenue: totalRevenuePaise / 100,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch admin statistics",
    });
  }
};

module.exports = {
  getAllMentors,
  verifyMentor,
  getAdminStats,
};

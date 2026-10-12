const FinancialLedger = require("../models/FinancialLedger");

// GET financial ledger entries for the logged-in mentor
const getMentorFinancialLedger = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can view their financial ledger",
      });
    }

    const Mentor = require("../models/Mentor");

    const mentor = await Mentor.findOne({ userId: req.user.id }).select("_id");

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    const Booking = require("../models/Booking");

    const bookings = await Booking.find({
      mentorId: mentor._id,
    }).select("_id");

    const bookingIds = bookings.map((booking) => booking._id);

    const entries = await FinancialLedger.find({
      bookingId: { $in: bookingIds },
    })
      .populate("bookingId", "status completedAt payoutEligibleAt mentorGrossPaise")
      .select(
        "bookingId paymentId currency studentPaidPaise commissionRateBps platformCommissionPaise mentorEarningsPaise status capturedAt bookingConfirmedAt completedAt payoutEligibleAt notes createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalEntries: entries.length,
      entries,
    });
  } catch (error) {
    console.error("Get mentor financial ledger error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch financial ledger",
    });
  }
};

module.exports = { getMentorFinancialLedger };
const Booking = require("../models/Booking");
const Mentor = require("../models/Mentor");

// GET MENTOR EARNINGS SUMMARY
const getMentorEarnings = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can view earnings",
      });
    }

    const mentor = await Mentor.findOne({
      userId: req.user.id,
    }).select("_id");

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    const now = new Date();

    // Only completed sessions count as earnings.
    const bookings = await Booking.find({
      mentorId: mentor._id,
      status: "COMPLETED",
    })
      .select(
        "_id pricePaise commissionPaise mentorGrossPaise completedAt payoutEligibleAt slotStart slotEnd"
      )
      .sort({ completedAt: -1 });

    let totalCompletedEarningsPaise = 0;
    let pendingEarningsPaise = 0;
    let eligibleEarningsPaise = 0;

    const completedSessions = bookings.map((booking) => {
      const amount = booking.mentorGrossPaise;
      const eligibleAt = booking.payoutEligibleAt;

      totalCompletedEarningsPaise += amount;

      if (!eligibleAt || eligibleAt > now) {
        pendingEarningsPaise += amount;
      } else {
        eligibleEarningsPaise += amount;
      }

      return {
        bookingId: booking._id,
        sessionPricePaise: booking.pricePaise,
        platformCommissionPaise: booking.commissionPaise,
        mentorEarningsPaise: amount,
        completedAt: booking.completedAt,
        payoutEligibleAt: eligibleAt,
        payoutStatus:
          !eligibleAt || eligibleAt > now
            ? "PENDING"
            : "ELIGIBLE",
      };
    });

    return res.status(200).json({
      success: true,
      message: "Mentor earnings fetched successfully",
      currency: "INR",
      summary: {
        completedSessions: bookings.length,
        totalCompletedEarningsPaise,
        pendingEarningsPaise,
        eligibleEarningsPaise,
        paidEarningsPaise: null,
        note:
          "Paid earnings will be available after payout records are implemented.",
      },
      completedSessions,
    });
  } catch (error) {
    console.error("Get mentor earnings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch mentor earnings",
    });
  }
};

module.exports = {
  getMentorEarnings,
};

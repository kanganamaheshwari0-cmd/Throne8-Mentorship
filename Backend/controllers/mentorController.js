
const Mentor = require("../models/Mentor");
const Booking = require("../models/Booking");
const Payout = require("../models/Payout");
const FinancialLedger = require("../models/FinancialLedger");

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
            typeof item === "string" &&
            item.trim().length > 0
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

// Get logged-in mentor's earnings and payout history
const getMyMentorEarnings = async (req, res) => {
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

    // Fetch completed bookings for this mentor.
    const bookings = await Booking.find({
      mentorId: mentor._id,
      status: "COMPLETED",
      completedAt: { $ne: null },
    })
      .select("_id completedAt")
      .lean();

    const bookingIds = bookings.map((booking) => booking._id);

    const bookingById = new Map(
      bookings.map((booking) => [
        booking._id.toString(),
        booking,
      ])
    );

    // Only confirmed financial ledgers for completed bookings count.
    const ledgers = await FinancialLedger.find({
      bookingId: { $in: bookingIds },
      status: "CONFIRMED",
      completedAt: { $ne: null },
    }).lean();

    // Reject mismatched completion timestamps and invalid amounts.
    const validLedgers = ledgers.filter((ledger) => {
      const booking = bookingById.get(
        ledger.bookingId.toString()
      );

      return (
        booking &&
        new Date(booking.completedAt).getTime() ===
          new Date(ledger.completedAt).getTime() &&
        Number.isSafeInteger(ledger.mentorEarningsPaise) &&
        ledger.mentorEarningsPaise > 0 &&
        ledger.payoutEligibleAt &&
        !Number.isNaN(
          new Date(ledger.payoutEligibleAt).getTime()
        )
      );
    });

    const payouts = await Payout.find({
      mentorId: mentor._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const payoutByBookingId = new Map();

    for (const payout of payouts) {
      payoutByBookingId.set(
        payout.bookingId.toString(),
        payout
      );
    }

    let totalCompletedEarningsPaise = 0;
    let pendingEarningsPaise = 0;
    let eligibleUnpaidEarningsPaise = 0;

    for (const ledger of validLedgers) {
      const earnings = ledger.mentorEarningsPaise;
      const bookingId = ledger.bookingId.toString();

      totalCompletedEarningsPaise += earnings;

      const payout = payoutByBookingId.get(bookingId);

      // Paid earnings must not appear again as unpaid earnings.
      if (payout && payout.status === "PAID") {
        continue;
      }

      // Active payout records already represent these earnings.
      if (
        payout &&
        ["PENDING", "APPROVED", "PROCESSING"].includes(
          payout.status
        )
      ) {
        continue;
      }

      // FAILED and CANCELLED payouts can become eligible again,
      // but only after rechecking the waiting period.
      const eligibleAt = new Date(ledger.payoutEligibleAt);

      if (eligibleAt <= now) {
        eligibleUnpaidEarningsPaise += earnings;
      } else {
        pendingEarningsPaise += earnings;
      }
    }

    const sumPayouts = (statuses) =>
      payouts
        .filter((payout) => statuses.includes(payout.status))
        .reduce(
          (total, payout) => total + payout.amountPaise,
          0
        );

    return res.status(200).json({
      success: true,
      currency: "INR",
      summary: {
        completedSessions: validLedgers.length,
        totalCompletedEarningsPaise,
        pendingEarningsPaise,
        eligibleUnpaidEarningsPaise,
        payoutPendingPaise: sumPayouts(["PENDING"]),
        payoutApprovedPaise: sumPayouts(["APPROVED"]),
        payoutProcessingPaise: sumPayouts(["PROCESSING"]),
        totalPaidPaise: sumPayouts(["PAID"]),
        payoutFailedPaise: sumPayouts(["FAILED"]),
        payoutCancelledPaise: sumPayouts(["CANCELLED"]),
      },
      payoutHistory: payouts,
      note:
        "Amounts are in paise. Earnings include confirmed financial ledgers for completed sessions. Failed and cancelled payouts may become eligible again after the waiting period, subject to admin review. Eligibility does not mean payout has been paid.",
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
  getAllMentors,
  getMyMentorProfile,
  updateMyMentorProfile,
  getMyMentorBookings,
  getMyMentorEarnings,
};

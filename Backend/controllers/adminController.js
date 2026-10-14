
const mongoose = require("mongoose");

const { logAudit } = require("../services/auditService");

const User = require("../models/User");
const Mentor = require("../models/Mentor");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const FinancialLedger = require("../models/FinancialLedger");

const getPagination = (query) => {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const limit =
    Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// GET ALL MENTORS
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Mentors fetched successfully",
      totalMentors: mentors.length,
      mentors,
    });
  } catch (error) {
    console.error("Get all mentors error:", error);

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

    if (!mongoose.isValidObjectId(mentorId)) {
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

    if (mentor.isVerified) {
      return res.status(200).json({
        success: true,
        message: "Mentor is already verified",
        mentor: {
          id: mentor._id,
          userId: mentor.userId,
          isVerified: mentor.isVerified,
        },
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
    console.error("Verify mentor error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify mentor",
    });
  }
};

// UPDATE MENTOR COMMISSION WITH AUDIT-FIRST SAFEGUARD
const updateMentorCommission = async (req, res) => {
  try {
    const { mentorId } = req.params;
    const { commissionRateBps } = req.body;

    if (!mongoose.isValidObjectId(mentorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mentor ID",
      });
    }

    if (
      !Number.isSafeInteger(commissionRateBps) ||
      commissionRateBps < 0 ||
      commissionRateBps > 10000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Commission must be a whole number between 0 and 10000 basis points",
      });
    }

    const mentor = await Mentor.findById(mentorId).populate(
      "userId",
      "name email"
    );

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    const previousRateBps = mentor.commissionRateBps;

    if (previousRateBps === commissionRateBps) {
      return res.status(200).json({
        success: true,
        message: "Commission rate is unchanged",
        auditRecorded: false,
        commission: {
          mentorId: mentor._id,
          mentorName: mentor.userId?.name,
          commissionRateBps,
          commissionPercentage: commissionRateBps / 100,
        },
      });
    }

    // Step 1: Save audit history BEFORE changing the mentor rate.
    // If audit creation fails, the commission remains unchanged.
    try {
      await logAudit({
        req,
        action: "MENTOR_COMMISSION_UPDATED",
        targetType: "Mentor",
        targetId: String(mentor._id),
        before: {
          commissionRateBps: previousRateBps,
          commissionPercentage: previousRateBps / 100,
        },
        after: {
          commissionRateBps,
          commissionPercentage: commissionRateBps / 100,
        },
        meta: {
          mentorName: mentor.userId?.name || "",
          mentorEmail: mentor.userId?.email || "",
        },
      });
    } catch (auditError) {
      console.error(
        "Commission audit logging failed:",
        auditError
      );

      return res.status(500).json({
        success: false,
        message:
          "Commission was not updated because audit history could not be recorded",
        auditRecorded: false,
      });
    }

    // Step 2: Update the current rate only after audit creation succeeds.
    try {
      mentor.commissionRateBps = commissionRateBps;
      await mentor.save();
    } catch (updateError) {
      console.error(
        "Commission update failed after audit creation:",
        updateError
      );

      return res.status(500).json({
        success: false,
        message:
          "Commission update failed. An audit record may already exist; verify the audit history before retrying.",
        auditRecorded: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Commission updated and audit history recorded",
      auditRecorded: true,
      commission: {
        mentorId: mentor._id,
        mentorName: mentor.userId?.name,
        previousRateBps,
        previousPercentage: previousRateBps / 100,
        commissionRateBps,
        commissionPercentage: commissionRateBps / 100,
      },
    });
  } catch (error) {
    console.error("Update mentor commission error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update mentor commission",
    });
  }
};

// COMMISSION OVERVIEW
const getCommissionOverview = async (req, res) => {
  try {
    const [mentorStats, ledgerStats] = await Promise.all([
      Mentor.aggregate([
        {
          $group: {
            _id: null,
            totalMentors: { $sum: 1 },
            verifiedMentors: {
              $sum: {
                $cond: ["$isVerified", 1, 0],
              },
            },
            averageCommissionRateBps: {
              $avg: {
                $ifNull: ["$commissionRateBps", 2000],
              },
            },
          },
        },
      ]),
      FinancialLedger.aggregate([
        {
          $match: {
            status: "CONFIRMED",
          },
        },
        {
          $group: {
            _id: null,
            confirmedLedgerCount: { $sum: 1 },
            totalStudentPaidPaise: {
              $sum: "$studentPaidPaise",
            },
            totalPlatformCommissionPaise: {
              $sum: "$platformCommissionPaise",
            },
            totalMentorEarningsPaise: {
              $sum: "$mentorEarningsPaise",
            },
          },
        },
      ]),
    ]);

    const mentors = mentorStats[0] || {};
    const ledger = ledgerStats[0] || {};
    const averageRateBps = Math.round(
      mentors.averageCommissionRateBps ?? 0
    );

    return res.status(200).json({
      success: true,
      currency: "INR",
      overview: {
        totalMentors: mentors.totalMentors || 0,
        verifiedMentors: mentors.verifiedMentors || 0,
        averageCommissionRateBps: averageRateBps,
        averageCommissionPercentage: averageRateBps / 100,
        confirmedLedgerCount: ledger.confirmedLedgerCount || 0,
        totalStudentPaidPaise:
          ledger.totalStudentPaidPaise || 0,
        totalPlatformCommissionPaise:
          ledger.totalPlatformCommissionPaise || 0,
        totalMentorEarningsPaise:
          ledger.totalMentorEarningsPaise || 0,
      },
      note:
        "Commission totals are aggregated from CONFIRMED FinancialLedger records. They are not estimates based on current mentor rates.",
    });
  } catch (error) {
    console.error("Commission overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch commission overview",
    });
  }
};

// BOOKING-WISE COMMISSION RECORDS
const getCommissionRecords = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {
      status: "CONFIRMED",
    };

    if (req.query.bookingId) {
      if (!mongoose.isValidObjectId(req.query.bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bookingId",
        });
      }

      filter.bookingId = new mongoose.Types.ObjectId(
        req.query.bookingId
      );
    }

    const [records, total] = await Promise.all([
      FinancialLedger.find(filter)
        .populate({
          path: "bookingId",
          select:
            "mentorId status completedAt slotStart slotEnd pricePaise",
          populate: {
            path: "mentorId",
            select: "userId",
            populate: {
              path: "userId",
              select: "name email",
            },
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FinancialLedger.countDocuments(filter),
    ]);

    const items = records.map((ledger) => {
      const booking =
        ledger.bookingId &&
        typeof ledger.bookingId === "object"
          ? ledger.bookingId
          : null;

      const mentor = booking?.mentorId || null;
      const mentorUser = mentor?.userId || null;

      return {
        ledgerId: ledger._id,
        bookingId: booking?._id || ledger.bookingId,
        bookingStatus: booking?.status || null,
        completedAt: ledger.completedAt,
        createdAt: ledger.createdAt,
        mentor: {
          id: mentor?._id || null,
          name: mentorUser?.name || "Unknown mentor",
          email: mentorUser?.email || "",
        },
        currency: ledger.currency,
        studentPaidPaise: ledger.studentPaidPaise,
        commissionRateBps: ledger.commissionRateBps,
        commissionPercentage:
          ledger.commissionRateBps / 100,
        platformCommissionPaise:
          ledger.platformCommissionPaise,
        mentorEarningsPaise: ledger.mentorEarningsPaise,
        ledgerStatus: ledger.status,
      };
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      records: items,
    });
  } catch (error) {
    console.error("Commission records error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch commission records",
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
      Payment.find({ status: "CAPTURED" })
        .select("amountPaise")
        .lean(),
    ]);

    const totalRevenuePaise = capturedPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.amountPaise || 0),
      0
    );

    return res.status(200).json({
      success: true,
      message:
        "Admin dashboard statistics fetched successfully",
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
    console.error("Admin stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch admin statistics",
    });
  }
};

module.exports = {
  getAllMentors,
  verifyMentor,
  updateMentorCommission,
  getCommissionOverview,
  getCommissionRecords,
  getAdminStats,
};

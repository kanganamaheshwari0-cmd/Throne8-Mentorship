const Mentor = require("../models/Mentor");
const Payment = require("../models/Payment");
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
      .sort({ slotStart: -1 })
      .lean();

    const bookingIds = bookings.map((booking) => booking._id);

    const payments = await Payment.find({
      bookingId: { $in: bookingIds },
    })
      .select(
        "_id bookingId status amountPaise currency refundedAmountPaise refunds"
      )
      .sort({ createdAt: -1 })
      .lean();

    const paymentsByBooking = new Map();

    for (const payment of payments) {
      const key = payment.bookingId.toString();

      // Keep the latest payment if multiple records exist.
      if (!paymentsByBooking.has(key)) {
        paymentsByBooking.set(key, payment);
      }
    }

    const bookingsWithPayment = bookings.map((booking) => {
      const payment = paymentsByBooking.get(
        booking._id.toString()
      );

      return {
        ...booking,
        payment: payment
          ? {
              _id: payment._id,
              status: payment.status,
              amountPaise: payment.amountPaise,
              currency: payment.currency,
              refundedAmountPaise: payment.refundedAmountPaise,
              refunds: payment.refunds,
            }
          : null,
        paymentStatus: payment?.status ?? null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Mentor bookings fetched successfully",
      totalBookings: bookingsWithPayment.length,
      bookings: bookingsWithPayment,
    });
  } catch (error) {
    console.error("Fetch mentor bookings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentors bookings",
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

    const bookings = await Booking.find({
      mentorId: mentor._id,
      status: "COMPLETED",
      completedAt: { $ne: null },
    })
      .select("_id completedAt")
      .lean();

    const bookingById = new Map(
      bookings.map((booking) => [
        booking._id.toString(),
        booking,
      ])
    );

    const bookingIds = bookings.map((booking) => booking._id);

    const [ledgers, payouts, payments] = await Promise.all([
      FinancialLedger.find({
        bookingId: { $in: bookingIds },
        status: "CONFIRMED",
        completedAt: { $ne: null },
      }).lean(),

      Payout.find({
        mentorId: mentor._id,
      })
        .sort({ createdAt: -1 })
        .lean(),

      Payment.find({
        bookingId: { $in: bookingIds },
      })
        .select(
          "_id bookingId status amountPaise refundedAmountPaise refunds"
        )
        .lean(),
    ]);

    const paymentsByBooking = new Map();

    for (const payment of payments) {
      const key = payment.bookingId.toString();

      if (!paymentsByBooking.has(key)) {
        paymentsByBooking.set(key, []);
      }

      paymentsByBooking.get(key).push(payment);
    }

    const payoutsByBooking = new Map();

    for (const payout of payouts) {
      const key = payout.bookingId.toString();

      if (!payoutsByBooking.has(key)) {
        payoutsByBooking.set(key, []);
      }

      payoutsByBooking.get(key).push(payout);
    }

    // Payout eligibility: completion + 15 UTC calendar days.
    const getEligibilityDate = (completedAt) => {
      const date = new Date(completedAt);
      date.setUTCDate(date.getUTCDate() + 15);
      return date;
    };

    const isPaymentRefundBlocked = (payment) => {
      const refunds = Array.isArray(payment.refunds)
        ? payment.refunds
        : [];

      return (
        ["PARTIALLY_REFUNDED", "REFUNDED"].includes(
          payment.status
        ) ||
        (Number.isSafeInteger(payment.refundedAmountPaise) &&
          payment.refundedAmountPaise > 0) ||
        refunds.some((refund) =>
          ["PENDING", "PROCESSED"].includes(refund.status)
        )
      );
    };

    const validLedgers = [];

    for (const ledger of ledgers) {
      const booking = bookingById.get(
        ledger.bookingId.toString()
      );

      if (!booking || !booking.completedAt || !ledger.completedAt) {
        continue;
      }

      if (
        new Date(booking.completedAt).getTime() !==
        new Date(ledger.completedAt).getTime()
      ) {
        continue;
      }

      const eligibleAt = getEligibilityDate(booking.completedAt);

      if (
        !ledger.payoutEligibleAt ||
        new Date(ledger.payoutEligibleAt).getTime() !==
          eligibleAt.getTime()
      ) {
        continue;
      }

      const paidPaise = ledger.studentPaidPaise;
      const commissionPaise = ledger.platformCommissionPaise;
      const mentorPaise = ledger.mentorEarningsPaise;
      const rateBps = ledger.commissionRateBps;

      if (
        !Number.isSafeInteger(paidPaise) ||
        paidPaise <= 0 ||
        !Number.isSafeInteger(commissionPaise) ||
        commissionPaise < 0 ||
        !Number.isSafeInteger(mentorPaise) ||
        mentorPaise <= 0 ||
        !Number.isSafeInteger(rateBps) ||
        rateBps < 0 ||
        rateBps > 10000
      ) {
        continue;
      }

      const expectedCommission = Math.round(
        (paidPaise * rateBps) / 10000
      );

      if (
        commissionPaise !== expectedCommission ||
        commissionPaise + mentorPaise !== paidPaise
      ) {
        continue;
      }

      const bookingPayments =
        paymentsByBooking.get(booking._id.toString()) || [];

      const linkedPayment = bookingPayments.find(
        (payment) =>
          payment._id.toString() ===
          ledger.paymentId?.toString()
      );

      if (
        !linkedPayment ||
        linkedPayment.status !== "CAPTURED" ||
        linkedPayment.amountPaise !== paidPaise ||
        bookingPayments.some(isPaymentRefundBlocked)
      ) {
        continue;
      }

      validLedgers.push({
        booking,
        eligibleAt,
        mentorPaise,
      });
    }

    const now = new Date();

    let totalCompletedEarningsPaise = 0;
    let pendingEarningsPaise = 0;
    let eligibleUnpaidEarningsPaise = 0;
    let completedSessions = 0;

    for (const item of validLedgers) {
      const { booking, eligibleAt, mentorPaise } = item;

      totalCompletedEarningsPaise += mentorPaise;
      completedSessions++;

      const bookingPayouts =
        payoutsByBooking.get(booking._id.toString()) || [];

      // Existing payout records must not be counted as unpaid.
      // A failed/cancelled payout needs a controlled retry flow.
      if (bookingPayouts.length > 0) {
        continue;
      }

      if (eligibleAt > now) {
        pendingEarningsPaise += mentorPaise;
      } else {
        eligibleUnpaidEarningsPaise += mentorPaise;
      }
    }

    const sumPayouts = (statuses) =>
      payouts
        .filter((payout) => statuses.includes(payout.status))
        .reduce((total, payout) => {
          const amount = payout.amountPaise;

          return Number.isSafeInteger(amount) && amount > 0
            ? total + amount
            : total;
        }, 0);

    return res.status(200).json({
      success: true,
      currency: "INR",
      summary: {
        completedSessions,
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
        "Earnings include validated captured payments and confirmed ledgers for completed sessions. Refund-affected or inconsistent records are excluded. Payout eligibility begins 15 UTC calendar days after completion. Existing payout records are not counted again as unpaid earnings.",
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

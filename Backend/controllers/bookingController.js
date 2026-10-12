
const crypto = require("crypto");

const Booking = require("../models/Booking");
const Mentor = require("../models/Mentor");
const Payment = require("../models/Payment");
const FinancialLedger = require("../models/FinancialLedger");

// CREATE BOOKING
const createBooking = async (req, res) => {
  let mentorIdForLock = null;
  let lockToken = null;

  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can create bookings",
      });
    }

    const { mentorId, slotStart, slotEnd } = req.body;

    if (
      !mentorId ||
      !slotStart ||
      !slotEnd ||
      typeof mentorId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(mentorId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid mentorId, slotStart and slotEnd are required",
      });
    }

    const start = new Date(slotStart);
    const end = new Date(slotEnd);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start <= new Date() ||
      end <= start
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid future time slot",
      });
    }

    const mentor = await Mentor.findById(mentorId);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    if (mentor.userId.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own mentorship session",
      });
    }

    if (mentor.isVerified !== true) {
      return res.status(400).json({
        success: false,
        message: "This mentor is not verified yet",
      });
    }

    const pricePaise = mentor.sessionPricePaise;
    const commissionRateBps = mentor.commissionRateBps;

    if (
      !Number.isSafeInteger(pricePaise) ||
      pricePaise < 1 ||
      !Number.isSafeInteger(commissionRateBps) ||
      commissionRateBps < 0 ||
      commissionRateBps > 10000
    ) {
      return res.status(500).json({
        success: false,
        message: "Mentor pricing or commission configuration is invalid",
      });
    }

    mentorIdForLock = mentor._id;
    lockToken = crypto.randomUUID();

    const lockUntil = new Date(Date.now() + 30000);

    const lockedMentor = await Mentor.findOneAndUpdate(
      {
        _id: mentorIdForLock,
        $or: [
          { bookingLockUntil: null },
          { bookingLockUntil: { $exists: false } },
          { bookingLockUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          bookingLockToken: lockToken,
          bookingLockUntil: lockUntil,
        },
      },
      { new: true }
    );

    if (!lockedMentor) {
      mentorIdForLock = null;

      return res.status(409).json({
        success: false,
        message: "Booking is being processed. Please try again shortly.",
      });
    }

    const overlappingBooking = await Booking.findOne({
      mentorId: mentorIdForLock,
      slotStart: { $lt: end },
      slotEnd: { $gt: start },
      $or: [
        { status: "CONFIRMED" },
        {
          status: "PENDING_PAYMENT",
          holdExpiresAt: { $gt: new Date() },
        },
      ],
    });

    if (overlappingBooking) {
      return res.status(409).json({
        success: false,
        message: "This mentor is not available for that time slot",
      });
    }

    const commissionPaise = Math.round(
      (pricePaise * commissionRateBps) / 10000
    );

    const mentorGrossPaise = pricePaise - commissionPaise;

    const booking = await Booking.create({
      studentId: req.user.id,
      mentorId: mentorIdForLock,
      slotStart: start,
      slotEnd: end,
      pricePaise,
      currency: "INR",
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      commissionRateBps,
      commissionPaise,
      mentorGrossPaise,
    });

    return res.status(201).json({
      success: true,
      message: "Booking created. Complete payment within 15 minutes.",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking",
    });
  } finally {
    if (mentorIdForLock && lockToken) {
      try {
        await Mentor.updateOne(
          {
            _id: mentorIdForLock,
            bookingLockToken: lockToken,
          },
          {
            $set: {
              bookingLockToken: null,
              bookingLockUntil: null,
            },
          }
        );
      } catch (lockError) {
        console.error("Booking lock release error:", lockError);
      }
    }
  }
};

// GET STUDENT'S BOOKINGS
const getMyBookings = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view their bookings",
      });
    }

    const now = new Date();

    const expiredBookings = await Booking.find({
      studentId: req.user.id,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { $lte: now },
    }).select("_id");

    if (expiredBookings.length > 0) {
      const expiredIds = expiredBookings.map((b) => b._id);

      const capturedIds = await Payment.find({
        bookingId: { $in: expiredIds },
        status: "CAPTURED",
      }).distinct("bookingId");

      const capturedSet = new Set(
        capturedIds.map((id) => id.toString())
      );

      const unpaidIds = expiredIds.filter(
        (id) => !capturedSet.has(id.toString())
      );

      if (unpaidIds.length > 0) {
        await Booking.updateMany(
          {
            _id: { $in: unpaidIds },
            status: "PENDING_PAYMENT",
            holdExpiresAt: { $lte: new Date() },
          },
          {
            $set: { status: "EXPIRED" },
          }
        );
      }
    }

    const bookings = await Booking.find({
      studentId: req.user.id,
    })
      .populate({
        path: "mentorId",
        select:
          "userId expertise sessionPricePaise isVerified commissionRateBps",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch bookings",
    });
  }
};

// GET LOGGED-IN MENTOR'S BOOKINGS
const getMentorBookings = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can view their bookings",
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
    })
      .populate("studentId", "name email")
      .sort({ createdAt: -1 });

    const now = new Date();

    const summary = {
      totalBookings: bookings.length,
      confirmed: 0,
      completed: 0,
      pendingPayment: 0,
      expired: 0,
      totalMentorEarningsPaise: 0,
      pendingPayoutPaise: 0,
      eligiblePayoutPaise: 0,
    };

    for (const booking of bookings) {
      if (booking.status === "CONFIRMED") {
        summary.confirmed++;
      }

      if (booking.status === "COMPLETED") {
        summary.completed++;

        const earnings = Number(booking.mentorGrossPaise) || 0;
        summary.totalMentorEarningsPaise += earnings;

        if (
          booking.payoutEligibleAt &&
          new Date(booking.payoutEligibleAt) <= now
        ) {
          summary.eligiblePayoutPaise += earnings;
        } else {
          summary.pendingPayoutPaise += earnings;
        }
      }

      if (booking.status === "PENDING_PAYMENT") {
        summary.pendingPayment++;
      }

      if (booking.status === "EXPIRED") {
        summary.expired++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Mentor bookings fetched successfully",
      summary,
      bookings,
    });
  } catch (error) {
    console.error("Get mentor bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch bookings",
    });
  }
};

// COMPLETE A MENTOR SESSION AND UPDATE FINANCIAL LEDGER
const completeMentorBooking = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can complete sessions",
      });
    }

    const { bookingId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(bookingId || "")) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
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

    const completedAt = new Date();

    // Only a confirmed booking belonging to this mentor can be completed.
    const booking = await Booking.findOne({
      _id: bookingId,
      mentorId: mentor._id,
      status: "CONFIRMED",
      slotEnd: { $lte: completedAt },
    }).select("_id");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Confirmed booking not found, or session has not ended yet",
      });
    }

    // 15 calendar days after completion.
    const payoutEligibleAt = new Date(completedAt);
    payoutEligibleAt.setUTCDate(payoutEligibleAt.getUTCDate() + 15);

    // Conditional update prevents two concurrent completion requests
    // from both completing the same booking.
    const completedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        mentorId: mentor._id,
        status: "CONFIRMED",
        slotEnd: { $lte: completedAt },
      },
      {
        $set: {
          status: "COMPLETED",
          completedAt,
          payoutEligibleAt,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!completedBooking) {
      return res.status(409).json({
        success: false,
        message: "Booking status changed. Refresh bookings and try again.",
      });
    }

    // Update only the existing ledger belonging to this booking.
    // Never create a ledger here: payment capture must create it first.
    try {
      const ledgerUpdate = await FinancialLedger.updateOne(
        {
          bookingId: completedBooking._id,
          status: "CONFIRMED",
        },
        {
          $set: {
            completedAt: completedBooking.completedAt,
            payoutEligibleAt: completedBooking.payoutEligibleAt,
          },
        },
        {
          runValidators: true,
        }
      );

      if (ledgerUpdate.matchedCount === 0) {
        console.error(
          "Financial ledger missing or not confirmed for completed booking:",
          completedBooking._id.toString()
        );

        return res.status(200).json({
          success: true,
          ledgerUpdated: false,
          reconciliationRequired: true,
          message:
            "Session completed, but its financial ledger needs reconciliation.",
          booking: completedBooking,
        });
      }
    } catch (ledgerError) {
      // Booking has already been completed. Do not pretend the ledger
      // was updated or undo the booking status without a transaction.
      console.error(
        "Financial ledger completion update failed:",
        ledgerError
      );

      return res.status(200).json({
        success: true,
        ledgerUpdated: false,
        reconciliationRequired: true,
        message:
          "Session completed, but the financial ledger update failed and requires reconciliation.",
        booking: completedBooking,
      });
    }

    return res.status(200).json({
      success: true,
      ledgerUpdated: true,
      message: "Mentor session completed and financial ledger updated successfully",
      booking: completedBooking,
    });
  } catch (error) {
    console.error("Complete mentor booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete mentor session",
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getMentorBookings,
  completeMentorBooking,
};

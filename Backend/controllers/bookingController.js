
const Booking = require("../models/Booking");
const Mentor = require("../models/Mentor");
const Payment = require("../models/Payment");

// CREATE BOOKING
const createBooking = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can create bookings",
      });
    }

    const { mentorId, slotStart, slotEnd } = req.body;

    if (!mentorId || !slotStart || !slotEnd) {
      return res.status(400).json({
        success: false,
        message: "mentorId, slotStart and slotEnd are required",
      });
    }

    const start = new Date(slotStart);
    const end = new Date(slotEnd);
    const now = new Date();

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot date or time",
      });
    }

    if (start <= now || end <= start) {
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

    const mentorUserId = mentor.userId.toString();

    if (mentorUserId === req.user.id) {
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

    const overlappingBooking = await Booking.findOne({
      mentorId: mentor._id,
      status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] },
      slotStart: { $lt: end },
      slotEnd: { $gt: start },
      $or: [
        { status: "CONFIRMED" },
        {
          status: "PENDING_PAYMENT",
          holdExpiresAt: { $gt: now },
        },
      ],
    });

    if (overlappingBooking) {
      return res.status(409).json({
        success: false,
        message: "This mentor is not available for that time slot",
      });
    }

    const pricePaise = mentor.sessionPricePaise;
    const commissionRateBps = mentor.commissionRateBps;

    const commissionPaise = Math.round(
      (pricePaise * commissionRateBps) / 10000
    );

    const mentorGrossPaise = pricePaise - commissionPaise;

    const holdExpiresAt = new Date(
      now.getTime() + 15 * 60 * 1000
    );

    const booking = await Booking.create({
      studentId: req.user.id,
      mentorId: mentor._id,
      slotStart: start,
      slotEnd: end,
      pricePaise,
      currency: "INR",
      status: "PENDING_PAYMENT",
      holdExpiresAt,
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
  }
};

// GET MY BOOKINGS
const getMyBookings = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view their bookings",
      });
    }

    // Mark expired unpaid bookings as EXPIRED.
// Do not expire a booking if its payment is already captured.
const now = new Date();

const expiredBookings = await Booking.find({
  studentId: req.user.id,
  status: "PENDING_PAYMENT",
  holdExpiresAt: { $lte: now },
}).select("_id");

if (expiredBookings.length > 0) {
  const expiredIds = expiredBookings.map(
    (booking) => booking._id
  );

  const capturedPayments = await Payment.find({
    bookingId: { $in: expiredIds },
    status: "CAPTURED",
  }).distinct("bookingId");

  await Booking.updateMany(
    {
      _id: {
        $in: expiredIds.filter(
          (id) =>
            !capturedPayments.some(
              (capturedId) => capturedId.toString() === id.toString()
            )
        ),
      },
      status: "PENDING_PAYMENT",
      holdExpiresAt: { $lte: new Date() },
    },
    {
      $set: { status: "EXPIRED" },
    }
  );
}

    const bookings = await Booking.find({
      studentId: req.user.id,
    })
      .populate({
        path: "mentorId",
        select: "userId expertise sessionPricePaise isVerified",
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


// COMPLETE A MENTOR SESSION
const completeMentorBooking = async (req, res) => {
  try {
    // Only mentors can complete sessions
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can complete sessions",
      });
    }

    const { bookingId } = req.params;

    if (!bookingId || !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // Find the logged-in mentor's profile
    const mentor = await Mentor.findOne({
      userId: req.user.id,
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    // Only this mentor's confirmed booking can be completed
    const booking = await Booking.findOne({
      _id: bookingId,
      mentorId: mentor._id,
      status: "CONFIRMED",
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Confirmed booking not found for this mentor",
      });
    }

    // Prevent completion before the session has ended
    if (new Date() < booking.slotEnd) {
      return res.status(400).json({
        success: false,
        message: "The session has not ended yet",
      });
    }

    booking.status = "COMPLETED";
    booking.completedAt = new Date();

    // Make payout eligible after session completion
    booking.payoutEligibleAt = new Date(
      booking.completedAt.getTime() + 24 * 60 * 60 * 1000
    );

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Mentor session completed successfully",
      booking,
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
  completeMentorBooking,
};


const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Payout = require("../models/Payout");
const FinancialLedger = require("../models/FinancialLedger");

// Completion time + 15 calendar days in UTC.
const getEligibilityDate = (completedAt) => {
  const eligibleAt = new Date(completedAt);
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + 15);
  return eligibleAt;
};

// Validate ledger, payment, and refund state before any payout action.
const validateLedgerPayment = async (ledger, bookingId) => {
  if (
    !ledger ||
    ledger.status !== "CONFIRMED" ||
    !ledger.paymentId ||
    !Number.isSafeInteger(ledger.studentPaidPaise) ||
    ledger.studentPaidPaise <= 0 ||
    !Number.isSafeInteger(ledger.mentorEarningsPaise) ||
    ledger.mentorEarningsPaise <= 0 ||
    !Number.isSafeInteger(ledger.platformCommissionPaise) ||
    ledger.platformCommissionPaise < 0 ||
    !Number.isSafeInteger(ledger.commissionRateBps) ||
    ledger.commissionRateBps < 0 ||
    ledger.commissionRateBps > 10000
  ) {
    return {
      valid: false,
      reason: "Missing or invalid confirmed financial ledger",
    };
  }

  const expectedCommission = Math.round(
    (ledger.studentPaidPaise * ledger.commissionRateBps) / 10000
  );

  if (
    ledger.platformCommissionPaise !== expectedCommission ||
    ledger.platformCommissionPaise + ledger.mentorEarningsPaise !==
      ledger.studentPaidPaise
  ) {
    return {
      valid: false,
      reason: "Financial ledger amounts do not reconcile",
    };
  }

  // Check every payment associated with this booking.
  const payments = await Payment.find({ bookingId })
    .select(
      "_id bookingId status amountPaise refundedAmountPaise refunds"
    )
    .lean();

  // Any existing refund amount blocks payout until the financial
  // state is reviewed and reconciled.
  const refundBlockingStatuses = [
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ];

  const refundInProgressOrCompleted = payments.some((payment) => {
    const refunds = Array.isArray(payment.refunds)
      ? payment.refunds
      : [];

    const hasActiveOrCompletedRefund = refunds.some((refund) =>
      ["PENDING", "PROCESSED"].includes(refund.status)
    );

    return (
      refundBlockingStatuses.includes(payment.status) ||
      (Number.isSafeInteger(payment.refundedAmountPaise) &&
        payment.refundedAmountPaise > 0) ||
      hasActiveOrCompletedRefund
    );
  });

  if (refundInProgressOrCompleted) {
    return {
      valid: false,
      reason:
        "Refund pending or completed for this booking; payout is blocked",
    };
  }

  const capturedPayment = payments.find(
    (payment) =>
      payment._id.toString() === ledger.paymentId.toString() &&
      payment.status === "CAPTURED"
  );

  if (!capturedPayment) {
    return {
      valid: false,
      reason: "Ledger payment is not captured",
    };
  }

  if (
    !Number.isSafeInteger(capturedPayment.amountPaise) ||
    capturedPayment.amountPaise !== ledger.studentPaidPaise
  ) {
    return {
      valid: false,
      reason: "Captured payment amount does not match the ledger",
    };
  }

  return { valid: true };
};

// Fetch the latest confirmed ledger and recheck payment/refund state.
const validateBookingForPayout = async (booking) => {
  if (
    !booking ||
    booking.status !== "COMPLETED" ||
    !booking.completedAt
  ) {
    return {
      valid: false,
      reason: "A completed booking is required",
    };
  }

  const ledger = await FinancialLedger.findOne({
    bookingId: booking._id,
    status: "CONFIRMED",
  }).lean();

  if (
    !ledger ||
    !ledger.completedAt ||
    new Date(ledger.completedAt).getTime() !==
      new Date(booking.completedAt).getTime()
  ) {
    return {
      valid: false,
      reason: "A matching confirmed financial ledger is required",
    };
  }

  const paymentCheck = await validateLedgerPayment(
    ledger,
    booking._id
  );

  if (!paymentCheck.valid) {
    return paymentCheck;
  }

  return { valid: true, ledger };
};

// GET ALL PAYOUT RECORDS
const getAdminPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find()
      .populate({
        path: "mentorId",
        select: "userId",
        populate: {
          path: "userId",
          select: "name email",
        },
      })
      .populate("bookingId", "status completedAt pricePaise")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      totalPayouts: payouts.length,
      payouts,
    });
  } catch (error) {
    console.error("Get admin payouts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch payout records",
    });
  }
};

// GET ADMIN FINANCE SUMMARY
const getAdminFinanceSummary = async (req, res) => {
  try {
    const now = new Date();

    const bookings = await Booking.find({
      status: "COMPLETED",
      completedAt: { $ne: null },
    })
      .select("_id mentorId status completedAt")
      .lean();

    const bookingMap = new Map(
      bookings.map((booking) => [
        booking._id.toString(),
        booking,
      ])
    );

    const bookingIds = bookings.map((booking) => booking._id);

    const [ledgers, payouts] = await Promise.all([
      FinancialLedger.find({
        bookingId: { $in: bookingIds },
        status: "CONFIRMED",
        completedAt: { $ne: null },
      }).lean(),
      Payout.find({}).lean(),
    ]);

    const payoutMap = new Map();

    for (const payout of payouts) {
      payoutMap.set(payout.bookingId.toString(), payout);
    }

    let completedSessions = 0;
    let totalCompletedEarningsPaise = 0;
    let pendingEligibilityPaise = 0;
    let eligibleUnpaidPaise = 0;

    for (const ledger of ledgers) {
      const booking = bookingMap.get(ledger.bookingId.toString());

      if (
        !booking ||
        !booking.completedAt ||
        !ledger.completedAt ||
        new Date(booking.completedAt).getTime() !==
          new Date(ledger.completedAt).getTime() ||
        !Number.isSafeInteger(ledger.mentorEarningsPaise) ||
        ledger.mentorEarningsPaise <= 0
      ) {
        continue;
      }

      const paymentCheck = await validateLedgerPayment(
        ledger,
        booking._id
      );

      if (!paymentCheck.valid) {
        continue;
      }

      const eligibleAt = getEligibilityDate(booking.completedAt);

      completedSessions++;
      totalCompletedEarningsPaise += ledger.mentorEarningsPaise;

      const payout = payoutMap.get(booking._id.toString());

      if (
        payout &&
        ["PENDING", "APPROVED", "PROCESSING", "PAID"].includes(
          payout.status
        )
      ) {
        continue;
      }

      if (eligibleAt > now) {
        pendingEligibilityPaise += ledger.mentorEarningsPaise;
      } else {
        eligibleUnpaidPaise += ledger.mentorEarningsPaise;
      }
    }

    const sumPayouts = (statuses) =>
      payouts
        .filter((payout) => statuses.includes(payout.status))
        .reduce(
          (total, payout) => total + Number(payout.amountPaise || 0),
          0
        );

    return res.status(200).json({
      success: true,
      currency: "INR",
      summary: {
        completedSessions,
        totalCompletedEarningsPaise,
        pendingEligibilityPaise,
        eligibleUnpaidPaise,
        payoutPendingPaise: sumPayouts(["PENDING"]),
        payoutApprovedPaise: sumPayouts(["APPROVED"]),
        payoutProcessingPaise: sumPayouts(["PROCESSING"]),
        totalPaidPaise: sumPayouts(["PAID"]),
        payoutFailedPaise: sumPayouts(["FAILED"]),
        payoutCancelledPaise: sumPayouts(["CANCELLED"]),
      },
      note:
        "Amounts are in paise. Refund-blocked bookings are excluded from eligible earnings. Approval does not mean money has been transferred.",
    });
  } catch (error) {
    console.error("Admin finance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin finance summary",
    });
  }
};

// GENERATE PAYOUT RECORDS FROM ELIGIBLE FINANCIAL LEDGERS
const generateEligiblePayouts = async (req, res) => {
  try {
    const now = new Date();

    const ledgers = await FinancialLedger.find({
      status: "CONFIRMED",
      completedAt: { $ne: null },
    })
      .populate({
        path: "bookingId",
        select: "mentorId status completedAt",
      })
      .lean();

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const ledger of ledgers) {
      const booking = ledger.bookingId;

      if (
        !booking ||
        booking.status !== "COMPLETED" ||
        !booking.completedAt ||
        !ledger.completedAt
      ) {
        skipped++;
        results.push({
          bookingId: booking?._id || ledger.bookingId,
          reason: "Completed booking and ledger are required",
        });
        continue;
      }

      if (
        new Date(ledger.completedAt).getTime() !==
        new Date(booking.completedAt).getTime()
      ) {
        skipped++;
        results.push({
          bookingId: booking._id,
          reason: "Booking and ledger completion times do not match",
        });
        continue;
      }

      const eligibleAt = getEligibilityDate(booking.completedAt);

      if (
        !ledger.payoutEligibleAt ||
        new Date(ledger.payoutEligibleAt).getTime() !==
          eligibleAt.getTime()
      ) {
        await FinancialLedger.updateOne(
          { _id: ledger._id, status: "CONFIRMED" },
          { $set: { payoutEligibleAt: eligibleAt } }
        );
      }

      if (eligibleAt > now) {
        skipped++;
        results.push({
          bookingId: booking._id,
          reason: "15-day waiting period has not ended",
          payoutEligibleAt: eligibleAt,
        });
        continue;
      }

      const paymentCheck = await validateLedgerPayment(
        ledger,
        booking._id
      );

      if (!paymentCheck.valid) {
        skipped++;
        results.push({
          bookingId: booking._id,
          reason: paymentCheck.reason,
        });
        continue;
      }

      if (
        !Number.isSafeInteger(ledger.mentorEarningsPaise) ||
        ledger.mentorEarningsPaise <= 0
      ) {
        skipped++;
        results.push({
          bookingId: booking._id,
          reason: "Invalid mentor earnings amount",
        });
        continue;
      }

      // Recheck the current booking, ledger and payment state immediately
      // before creating a payout record.
      const latestBooking = await Booking.findById(booking._id)
        .select("_id mentorId status completedAt")
        .lean();

      const latestCheck = await validateBookingForPayout(latestBooking);

      if (
        !latestCheck.valid ||
        latestCheck.ledger.mentorEarningsPaise !==
          ledger.mentorEarningsPaise
      ) {
        skipped++;
        results.push({
          bookingId: booking._id,
          reason: latestCheck.valid
            ? "Ledger earnings changed; payout requires rechecking"
            : latestCheck.reason,
        });
        continue;
      }

      try {
        await Payout.create({
          mentorId: latestBooking.mentorId,
          bookingId: latestBooking._id,
          amountPaise: latestCheck.ledger.mentorEarningsPaise,
          currency: "INR",
          status: "PENDING",
          payoutEligibleAt: eligibleAt,
        });

        created++;

        results.push({
          bookingId: latestBooking._id,
          result: "PAYOUT_CREATED",
          amountPaise: latestCheck.ledger.mentorEarningsPaise,
        });
      } catch (error) {
        if (error.code === 11000) {
          skipped++;
          results.push({
            bookingId: booking._id,
            reason: "Payout already exists for this booking",
          });
          continue;
        }

        throw error;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Eligible payout generation completed",
      checked: ledgers.length,
      created,
      skipped,
      results,
      note: "Admin review only. No money was transferred.",
    });
  } catch (error) {
    console.error("Generate payouts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to generate eligible payouts",
    });
  }
};

// APPROVE A PENDING PAYOUT
const approvePayout = async (req, res) => {
  try {
    const { payoutId } = req.params;

    if (!mongoose.isValidObjectId(payoutId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout ID",
      });
    }

    const payout = await Payout.findById(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    if (payout.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `Only PENDING payouts can be approved. Current status: ${payout.status}`,
      });
    }

    const booking = await Booking.findById(payout.bookingId);

    if (
      !booking ||
      booking.mentorId.toString() !== payout.mentorId.toString()
    ) {
      return res.status(409).json({
        success: false,
        message: "Booking or mentor does not match the payout",
      });
    }

    const validation = await validateBookingForPayout(booking);

    if (!validation.valid) {
      return res.status(409).json({
        success: false,
        message: validation.reason,
      });
    }

    const ledger = validation.ledger;
    const eligibleAt = getEligibilityDate(ledger.completedAt);

    if (
      !payout.payoutEligibleAt ||
      new Date(payout.payoutEligibleAt).getTime() !==
        eligibleAt.getTime()
    ) {
      return res.status(409).json({
        success: false,
        message: "Payout eligibility date does not match the completion date",
        expectedPayoutEligibleAt: eligibleAt,
      });
    }

    if (eligibleAt > new Date()) {
      return res.status(409).json({
        success: false,
        message: "The 15-day payout waiting period has not ended",
        payoutEligibleAt: eligibleAt,
      });
    }

    if (payout.amountPaise !== ledger.mentorEarningsPaise) {
      return res.status(409).json({
        success: false,
        message: "Payout amount does not match mentor ledger earnings",
      });
    }

    // Re-read the ledger and payment state immediately before approval.
    const finalValidation = await validateBookingForPayout(
      await Booking.findById(booking._id)
    );

    if (
      !finalValidation.valid ||
      finalValidation.ledger.mentorEarningsPaise !== payout.amountPaise
    ) {
      return res.status(409).json({
        success: false,
        message: finalValidation.valid
          ? "Ledger earnings changed; payout requires review"
          : finalValidation.reason,
      });
    }

    // Atomic status transition prevents two admins from approving the
    // same PENDING payout at the same time.
    const approvedPayout = await Payout.findOneAndUpdate(
      {
        _id: payout._id,
        status: "PENDING",
      },
      {
        $set: {
          status: "APPROVED",
          approvedAt: new Date(),
          payoutEligibleAt: eligibleAt,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!approvedPayout) {
      return res.status(409).json({
        success: false,
        message: "Payout status changed. Refresh and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payout approved for processing",
      payout: approvedPayout,
      note: "No money was transferred.",
    });
  } catch (error) {
    console.error("Approve payout error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve payout",
    });
  }
};

module.exports = {
  getAdminPayouts,
  getAdminFinanceSummary,
  generateEligiblePayouts,
  approvePayout,
};

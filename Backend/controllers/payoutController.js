const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Payout = require("../models/Payout");
const Refund = require("../models/Refund");
const FinancialLedger = require("../models/FinancialLedger");
const {
  calculateEligibilityDate,
} = require("../services/payoutEligibilityService");

const BLOCKING_REFUND_STATUSES = [
  "REQUESTED",
  "PROCESSING",
  "PROCESSED",
  "RECONCILIATION_REQUIRED",
];

const ACTIVE_PAYOUT_STATUSES = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "PAID",
];
// Shared service ensures consistent UTC payout eligibility calculation.
const getEligibilityDate = calculateEligibilityDate;

// Validate the ledger's financial amounts.
const validateLedgerAmounts = (ledger) => {
  if (
    !ledger ||
    !["CONFIRMED", "PAYOUT_APPROVED"].includes(ledger.status) ||
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
      reason: "Missing or invalid financial ledger",
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

  return { valid: true };
};

// Validate captured payment and related refund records.
const validateLedgerPayment = async (ledger, bookingId) => {
  const amountCheck = validateLedgerAmounts(ledger);

  if (!amountCheck.valid) {
    return amountCheck;
  }

  const [payments, refunds] = await Promise.all([
    Payment.find({ bookingId })
      .select(
        "_id bookingId status amountPaise refundedAmountPaise refunds"
      )
      .lean(),

    Refund.find({
      bookingId,
      status: { $in: BLOCKING_REFUND_STATUSES },
    })
      .select("_id status amountPaise paymentId")
      .lean(),
  ]);

  if (refunds.length > 0) {
    return {
      valid: false,
      reason:
        "A refund is pending, processed, or requires reconciliation; payout is blocked",
    };
  }

  const paymentRefundExists = payments.some((payment) => {
    const embeddedRefunds = Array.isArray(payment.refunds)
      ? payment.refunds
      : [];

    return (
      ["PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status) ||
      (Number.isSafeInteger(payment.refundedAmountPaise) &&
        payment.refundedAmountPaise > 0) ||
      embeddedRefunds.some((refund) =>
        ["PENDING", "PROCESSED"].includes(refund.status)
      )
    );
  });

  if (paymentRefundExists) {
    return {
      valid: false,
      reason: "Payment refund information blocks payout",
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

// Verify booking, ledger, completion time, payment, and refunds.
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
      reason:
        "A matching confirmed ledger is required; it may already be locked for refund, payout, or review",
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

    const failedPayouts = payouts.filter(
      (payout) => payout.status === "FAILED"
    );

    const totalFailedAmountPaise = failedPayouts.reduce(
      (total, payout) => total + Number(payout.amountPaise || 0),
      0
    );

    return res.status(200).json({
      success: true,
      totalPayouts: payouts.length,
      payouts,
      failedPayouts,
      failedPayoutSummary: {
        count: failedPayouts.length,
        totalAmountPaise: totalFailedAmountPaise,
        currency: "INR",
      },
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

    console.log(
      "PAYOUT HOLDING PERIOD (MINUTES):",
      require("../services/payoutEligibilityService").HOLDING_PERIOD_MINUTES
    );

    const bookings = await Booking.find({
      status: "COMPLETED",
      completedAt: { $ne: null },
    })
      .select("_id mentorId status completedAt")
      .lean();

    const bookingMap = new Map(
      bookings.map((booking) => [booking._id.toString(), booking])
    );

    const bookingIds = bookings.map((booking) => booking._id);

    const [ledgers, payouts] = await Promise.all([
      FinancialLedger.find({
        bookingId: { $in: bookingIds },
        status: { $in: ["CONFIRMED", "PAYOUT_APPROVED"] },
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
          new Date(ledger.completedAt).getTime()
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

      completedSessions++;
      totalCompletedEarningsPaise += ledger.mentorEarningsPaise;

      const payout = payoutMap.get(booking._id.toString());

      if (
        payout &&
        ACTIVE_PAYOUT_STATUSES.includes(payout.status)
      ) {
        continue;
      }

      // Approved ledger earnings are not available for another payout.
      if (ledger.status === "PAYOUT_APPROVED") {
        continue;
      }

      const eligibleAt = getEligibilityDate(booking.completedAt);

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
        "Amounts are in paise. Refund-blocked bookings are excluded. Approval does not mean money has been transferred.",
    });
  } catch (error) {
    console.error("Admin finance summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin finance summary",
    });
  }
};

// GENERATE ELIGIBLE PAYOUT RECORDS
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
    console.log("PAYOUT GENERATION STARTED");

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
          reason: "Payout holding period has not ended",
          payoutEligibleAt: eligibleAt,
        });

        continue;
      }

      const validation = await validateBookingForPayout(booking);

      if (!validation.valid) {
        skipped++;

        results.push({
          bookingId: booking._id,
          reason: validation.reason,
        });

        continue;
      }

      try {
        await Payout.create({
          mentorId: booking.mentorId,
          bookingId: booking._id,
          amountPaise: validation.ledger.mentorEarningsPaise,
          currency: "INR",
          status: "PENDING",
          payoutEligibleAt: eligibleAt,
        });

        created++;

        results.push({
          bookingId: booking._id,
          result: "PAYOUT_CREATED",
          amountPaise: validation.ledger.mentorEarningsPaise,
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
// The ledger is conditionally locked before approval.
const approvePayout = async (req, res) => {
  let lockedLedgerId = null;
  let payoutApprovalCompleted = false;

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
      !booking.mentorId ||
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
        message: "Payout eligibility date does not match completion date",
        expectedPayoutEligibleAt: eligibleAt,
      });
    }

    if (eligibleAt > new Date()) {
      return res.status(409).json({
        success: false,
        message: "The payout holding period has not ended",
        payoutEligibleAt: eligibleAt,
      });
    }

    if (payout.amountPaise !== ledger.mentorEarningsPaise) {
      return res.status(409).json({
        success: false,
        message: "Payout amount does not match mentor ledger earnings",
      });
    }

    // Shared conditional lock with requestRefund:
    // refund: CONFIRMED -> REFUND_PENDING
    // payout: CONFIRMED -> PAYOUT_APPROVED
    const lockedLedger = await FinancialLedger.findOneAndUpdate(
      {
        _id: ledger._id,
        status: "CONFIRMED",
        bookingId: booking._id,
        paymentId: ledger.paymentId,
      },
      {
        $set: {
          status: "PAYOUT_APPROVED",
          notes:
            "Payout approved; refund requests are blocked pending payout review",
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!lockedLedger) {
      return res.status(409).json({
        success: false,
        message:
          "Ledger is no longer available for payout approval. Check refund or reconciliation status.",
      });
    }

    lockedLedgerId = lockedLedger._id;

    // Recheck payments and refunds after acquiring the ledger lock.
    const finalPaymentCheck = await validateLedgerPayment(
      lockedLedger.toObject(),
      booking._id
    );

    if (!finalPaymentCheck.valid) {
      await FinancialLedger.updateOne(
        {
          _id: lockedLedger._id,
          status: "PAYOUT_APPROVED",
        },
        {
          $set: {
            status: "REVIEW_REQUIRED",
            notes:
              "Payout approval blocked; financial state requires review",
          },
        }
      );

      lockedLedgerId = null;

      return res.status(409).json({
        success: false,
        message: finalPaymentCheck.reason,
      });
    }

    // Only one request may change the payout from PENDING to APPROVED.
    const approvedPayout = await Payout.findOneAndUpdate(
      {
        _id: payout._id,
        status: "PENDING",
        bookingId: booking._id,
        mentorId: booking.mentorId,
        amountPaise: lockedLedger.mentorEarningsPaise,
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
      // Do not automatically unlock the ledger in an unexpected state.
      await FinancialLedger.updateOne(
        {
          _id: lockedLedger._id,
          status: "PAYOUT_APPROVED",
        },
        {
          $set: {
            status: "REVIEW_REQUIRED",
            notes:
              "Payout approval did not complete normally; manual financial review required",
          },
        }
      );

      lockedLedgerId = null;

      return res.status(409).json({
        success: false,
        message:
          "Payout status changed or could not be safely approved. Check payout and ledger records.",
      });
    }

    payoutApprovalCompleted = true;
    lockedLedgerId = null;

    return res.status(200).json({
      success: true,
      message: "Payout approved for processing",
      payout: approvedPayout,
      note:
        "No money was transferred. A separate verified payout process is required.",
    });
  } catch (error) {
    console.error("Approve payout error:", error);

    if (lockedLedgerId && !payoutApprovalCompleted) {
      try {
        // Never restore CONFIRMED automatically after an unexpected error.
        // Inspect the persisted payout state and preserve the ledger lock.
        const latestPayout = mongoose.isValidObjectId(req.params.payoutId)
          ? await Payout.findById(req.params.payoutId).lean()
          : null;

        if (
          latestPayout &&
          ["APPROVED", "PROCESSING", "PAID"].includes(
            latestPayout.status
          )
        ) {
          await FinancialLedger.updateOne(
            {
              _id: lockedLedgerId,
              status: "PAYOUT_APPROVED",
            },
            {
              $set: {
                notes:
                  "Payout may already be approved or processing; preserve ledger lock and verify records",
              },
            }
          );
        } else {
          await FinancialLedger.updateOne(
            {
              _id: lockedLedgerId,
              status: "PAYOUT_APPROVED",
            },
            {
              $set: {
                status: "REVIEW_REQUIRED",
                notes:
                  "Payout state could not be safely confirmed after an error; manual reconciliation required",
              },
            }
          );
        }
      } catch (recoveryError) {
        console.error(
          "Payout recovery failed; manual review required:",
          recoveryError.message
        );

        // Best effort only. If MongoDB is unavailable, preserve the lock.
        await FinancialLedger.updateOne(
          {
            _id: lockedLedgerId,
            status: "PAYOUT_APPROVED",
          },
          {
            $set: {
              status: "REVIEW_REQUIRED",
              notes:
                "Could not verify payout state after an error; manual reconciliation required",
            },
          }
        ).catch((ledgerError) => {
          console.error(
            "Could not mark ledger for review:",
            ledgerError.message
          );
        });
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to confirm payout approval. Check payout and ledger status before retrying.",
    });
  }
};

module.exports = {
  getAdminPayouts,
  getAdminFinanceSummary,
  generateEligiblePayouts,
  approvePayout,
};
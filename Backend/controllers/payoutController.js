const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Payout = require("../models/Payout");
const FinancialLedger = require("../models/FinancialLedger");

// Business rule: completion time + 15 calendar days in UTC.
const getEligibilityDate = (completedAt) => {
  const eligibleAt = new Date(completedAt);
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + 15);
  return eligibleAt;
};

// Validate the captured payment against its financial ledger.
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

  // Validate that the ledger's financial breakdown is consistent.
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

  const payments = await Payment.find({ bookingId })
    .select("_id bookingId status amountPaise")
    .lean();

  const hasRefund = payments.some((payment) =>
    ["PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)
  );

  if (hasRefund) {
    return {
      valid: false,
      reason: "A refund exists for this booking",
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

      try {
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

        // Ledger and booking completion timestamps must agree.
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

        const eligibleAt = getEligibilityDate(ledger.completedAt);

        // Repair a stale eligibility timestamp in the ledger.
        if (
          !ledger.payoutEligibleAt ||
          new Date(ledger.payoutEligibleAt).getTime() !==
            eligibleAt.getTime()
        ) {
          await FinancialLedger.updateOne(
            {
              _id: ledger._id,
              status: "CONFIRMED",
            },
            {
              $set: { payoutEligibleAt: eligibleAt },
            }
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

        try {
          await Payout.create({
            mentorId: booking.mentorId,
            bookingId: booking._id,
            amountPaise: ledger.mentorEarningsPaise,
            currency: "INR",
            status: "PENDING",
            payoutEligibleAt: eligibleAt,
          });

          created++;

          results.push({
            bookingId: booking._id,
            result: "PAYOUT_CREATED",
            amountPaise: ledger.mentorEarningsPaise,
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
      } catch (bookingError) {
        console.error(
          "Payout generation failed for ledger:",
          ledger._id,
          bookingError
        );
        throw bookingError;
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
      booking.status !== "COMPLETED" ||
      !booking.completedAt ||
      booking.mentorId.toString() !== payout.mentorId.toString()
    ) {
      return res.status(409).json({
        success: false,
        message: "Booking or mentor is not eligible for payout approval",
      });
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
      return res.status(409).json({
        success: false,
        message: "A matching confirmed financial ledger is required",
      });
    }

    const eligibleAt = getEligibilityDate(ledger.completedAt);

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

    const paymentCheck = await validateLedgerPayment(
      ledger,
      booking._id
    );

    if (!paymentCheck.valid) {
      return res.status(409).json({
        success: false,
        message: paymentCheck.reason,
      });
    }

    // Conditional update prevents two concurrent approvals.
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
  generateEligiblePayouts,
  approvePayout,
};
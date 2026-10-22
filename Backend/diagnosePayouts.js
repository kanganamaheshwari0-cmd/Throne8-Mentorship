require("dotenv").config();
const mongoose = require("mongoose");

const Booking = require("./models/Booking");
const FinancialLedger = require("./models/FinancialLedger");
const Payment = require("./models/Payment");
const Refund = require("./models/Refund");
const Payout = require("./models/Payout");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const bookings = await Booking.find({
    status: "COMPLETED",
    completedAt: { $ne: null },
  }).select("_id status completedAt mentorId").lean();

  const report = [];

  for (const booking of bookings) {
    const ledger = await FinancialLedger.findOne({
      bookingId: booking._id,
    }).lean();

    const paymentByLedgerId = ledger?.paymentId
      ? await Payment.findById(ledger.paymentId)
          .select("_id bookingId status amountPaise refundedAmountPaise")
          .lean()
      : null;

    const payments = await Payment.find({
      bookingId: booking._id,
    }).select("_id status amountPaise refundedAmountPaise").lean();

    const refunds = await Refund.find({
      bookingId: booking._id,
      status: {
        $in: ["REQUESTED", "PROCESSING", "PROCESSED", "RECONCILIATION_REQUIRED"],
      },
    }).select("status amountPaise").lean();

    const payout = await Payout.findOne({
      bookingId: booking._id,
    }).select("status amountPaise").lean();

    report.push({
      bookingId: booking._id.toString(),
      completedAt: booking.completedAt,
      ledger: ledger ? {
        status: ledger.status,
        paymentId: ledger.paymentId?.toString(),
        completedAt: ledger.completedAt,
        mentorEarningsPaise: ledger.mentorEarningsPaise,
        payoutEligibleAt: ledger.payoutEligibleAt,
      } : null,
      paymentByLedgerId: paymentByLedgerId ? {
        id: paymentByLedgerId._id.toString(),
        bookingId: paymentByLedgerId.bookingId?.toString(),
        status: paymentByLedgerId.status,
        amountPaise: paymentByLedgerId.amountPaise,
      } : null,
      payments: payments.map(p => ({
        id: p._id.toString(),
        status: p.status,
        amountPaise: p.amountPaise,
        refundedAmountPaise: p.refundedAmountPaise,
      })),
      blockingRefunds: refunds,
      payout: payout ? {
        status: payout.status,
        amountPaise: payout.amountPaise,
      } : null,
    });
  }

  console.log(JSON.stringify({
    completedBookings: bookings.length,
    payoutRecords: await Payout.countDocuments(),
    report,
  }, null, 2));
}

main()
  .catch(error => {
    console.error("Diagnostic failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });


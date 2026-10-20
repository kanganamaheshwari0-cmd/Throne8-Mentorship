
const Razorpay = require("razorpay");

const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const FinancialLedger = require("../models/FinancialLedger");
const { recordPaymentCaptured } = require("../services/ledgerEntryService");

const repairMissingLedgerEntries = async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId || typeof paymentId !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid paymentId is required.",
      });
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return res.status(503).json({
        success: false,
        message: "Razorpay verification is not configured.",
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    if (payment.status !== "CAPTURED" || !payment.gatewayPaymentId) {
      return res.status(409).json({
        success: false,
        message: "Only locally captured payments with a provider payment ID can be recovered.",
      });
    }

    const booking = await Booking.findById(payment.bookingId);

    if (!booking) {
      return res.status(409).json({
        success: false,
        message: "Associated booking was not found. Manual review is required.",
      });
    }

    const ledger = await FinancialLedger.findOne({
      paymentId: payment._id,
    }).lean();

    if (!ledger) {
      return res.status(409).json({
        success: false,
        message: "FinancialLedger is missing. This endpoint only repairs LedgerEntry lines.",
      });
    }

    // Confirm the local financial records agree before writing anything.
    if (
      String(ledger.bookingId) !== String(booking._id) ||
      String(payment.bookingId) !== String(booking._id) ||
      payment.amountPaise !== booking.pricePaise ||
      ledger.studentPaidPaise !== payment.amountPaise ||
      ledger.currency !== payment.currency ||
      booking.currency !== payment.currency ||
      ledger.platformCommissionPaise !== booking.commissionPaise ||
      ledger.mentorEarningsPaise !== booking.mentorGrossPaise ||
      ledger.platformCommissionPaise + ledger.mentorEarningsPaise !==
        ledger.studentPaidPaise
    ) {
      return res.status(409).json({
        success: false,
        message: "Local payment, booking and financial ledger do not agree. No entries were created.",
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const providerPayment = await razorpay.payments.fetch(
      payment.gatewayPaymentId
    );

    if (
      providerPayment.status !== "captured" ||
      providerPayment.id !== payment.gatewayPaymentId ||
      providerPayment.order_id !== payment.gatewayOrderId ||
      providerPayment.amount !== payment.amountPaise ||
      providerPayment.currency !== payment.currency
    ) {
      return res.status(409).json({
        success: false,
        message: "Razorpay verification failed. No entries were created.",
      });
    }

    // The service is idempotent and verifies existing lines before reuse.
    const result = await recordPaymentCaptured({ booking, payment });

    return res.status(200).json({
      success: true,
      message: "Captured-payment ledger entries verified.",
      paymentId: String(payment._id),
      bookingId: String(booking._id),
      created: result.created,
      total: result.total,
      moneyTransferred: false,
    });
  } catch (error) {
    console.error("Ledger entry recovery failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Ledger entry recovery failed. Check the backend logs.",
    });
  }
};

module.exports = { repairMissingLedgerEntries };

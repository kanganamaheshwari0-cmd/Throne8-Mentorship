
const Refund = require("../models/Refund");
const Payment = require("../models/Payment");

const createRefundRequest = async ({
  paymentId,
  bookingId,
  amountPaise,
  reason,
  requestedBy,
}) => {
  if (!paymentId || !bookingId || !requestedBy) {
    throw new Error(
      "Payment, booking and requester details are required"
    );
  }

  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error("Invalid refund amount");
  }

  if (!reason || !reason.trim()) {
    throw new Error("Refund reason is required");
  }

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.bookingId.toString() !== bookingId.toString()) {
    throw new Error("Payment does not belong to this booking");
  }

  if (payment.status !== "CAPTURED") {
    throw new Error("Only captured payments can be refunded");
  }

  if (amountPaise > payment.amountPaise) {
    throw new Error("Refund amount exceeds payment amount");
  }

  const refund = await Refund.create({
    paymentId,
    bookingId,
    amountPaise,
    reason: reason.trim(),
    requestedBy,
    status: "REQUESTED",
  });

  return refund;
};

module.exports = { createRefundRequest };
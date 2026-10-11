
const Payment = require("../models/Payment");

const createPaymentRecord = async ({
  bookingId,
  gatewayOrderId,
  amountPaise,
  currency = "INR",
}) => {
  if (!bookingId || !gatewayOrderId) {
    throw new Error("Booking ID and gateway order ID are required");
  }

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Invalid payment amount");
  }

  const payment = await Payment.create({
    bookingId,
    gateway: "razorpay",
    gatewayOrderId,
    amountPaise,
    currency,
    status: "CREATED",
  });

  return payment;
};

const findPaymentByOrderId = async (gatewayOrderId) => {
  if (!gatewayOrderId) {
    throw new Error("Gateway order ID is required");
  }

  return Payment.findOne({ gatewayOrderId });
};

module.exports = {
  createPaymentRecord,
  findPaymentByOrderId,
};
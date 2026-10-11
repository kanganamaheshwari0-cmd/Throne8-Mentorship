
const Earning = require("../models/Earning");
const { calculateCommission } = require("./commissionService");
const {
  calculateEligibilityDate,
} = require("./payoutEligibilityService");

const createEarning = async ({
  bookingId,
  mentorId,
  grossPaise,
  commissionRate,
  sessionCompletedAt,
}) => {
  if (!bookingId || !mentorId || !sessionCompletedAt) {
    throw new Error(
      "Booking, mentor and session completion details are required"
    );
  }

  const amounts = calculateCommission({
    grossPaise,
    commissionRate,
  });

  const eligibleAt = calculateEligibilityDate(
    sessionCompletedAt
  );

  const earning = await Earning.create({
    bookingId,
    mentorId,
    grossPaise: amounts.grossPaise,
    commissionPaise: amounts.commissionPaise,
    payablePaise: amounts.payablePaise,
    eligibleAt,
    state: "HOLDING",
  });

  return earning;
};

module.exports = { createEarning };
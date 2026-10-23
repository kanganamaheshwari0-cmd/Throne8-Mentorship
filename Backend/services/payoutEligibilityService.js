
const HOLDING_PERIOD_MINUTES = Number(
  process.env.PAYOUT_HOLDING_PERIOD_MINUTES || 1
);

const MILLISECONDS_PER_MINUTE = 60 * 1000;

const calculateEligibilityDate = (sessionCompletedAt) => {
  const completedAt = new Date(sessionCompletedAt);

  if (Number.isNaN(completedAt.getTime())) {
    throw new Error("Invalid session completion date");
  }

  if (
    !Number.isSafeInteger(HOLDING_PERIOD_MINUTES) ||
    HOLDING_PERIOD_MINUTES < 1
  ) {
    throw new Error(
      "PAYOUT_HOLDING_PERIOD_MINUTES must be a positive integer"
    );
  }

  return new Date(
    completedAt.getTime() +
      HOLDING_PERIOD_MINUTES * MILLISECONDS_PER_MINUTE
  );
};

const isPayoutEligible = ({
  sessionCompletedAt,
  now = new Date(),
  hasActiveDispute = false,
  refundPending = false,
}) => {
  const eligibleAt = calculateEligibilityDate(sessionCompletedAt);
  const currentTime = new Date(now);

  if (Number.isNaN(currentTime.getTime())) {
    throw new Error("Invalid current date");
  }

  return (
    currentTime.getTime() >= eligibleAt.getTime() &&
    !hasActiveDispute &&
    !refundPending
  );
};

module.exports = {
  HOLDING_PERIOD_MINUTES,
  calculateEligibilityDate,
  isPayoutEligible,
};

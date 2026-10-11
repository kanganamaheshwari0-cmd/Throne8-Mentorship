
const HOLDING_PERIOD_DAYS = 15;

const calculateEligibilityDate = (sessionCompletedAt) => {
  const completedAt = new Date(sessionCompletedAt);

  if (Number.isNaN(completedAt.getTime())) {
    throw new Error("Invalid session completion date");
  }

  const eligibleAt = new Date(completedAt);

  eligibleAt.setDate(
    eligibleAt.getDate() + HOLDING_PERIOD_DAYS
  );

  return eligibleAt;
};

const isPayoutEligible = ({
  sessionCompletedAt,
  now = new Date(),
  hasActiveDispute = false,
  refundPending = false,
}) => {
  const eligibleAt = calculateEligibilityDate(
    sessionCompletedAt
  );

  const currentTime = new Date(now);

  if (Number.isNaN(currentTime.getTime())) {
    throw new Error("Invalid current date");
  }

  return (
    currentTime >= eligibleAt &&
    !hasActiveDispute &&
    !refundPending
  );
};

module.exports = {
  HOLDING_PERIOD_DAYS,
  calculateEligibilityDate,
  isPayoutEligible,
};
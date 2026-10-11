
const calculateCommission = ({
  grossPaise,
  commissionRate,
}) => {
  if (
    !Number.isSafeInteger(grossPaise) ||
    grossPaise <= 0
  ) {
    throw new Error("Invalid gross amount");
  }

  if (
    typeof commissionRate !== "number" ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error("Invalid commission rate");
  }

  const commissionPaise = Math.round(
    (grossPaise * commissionRate) / 100
  );

  const payablePaise = grossPaise - commissionPaise;

  return {
    grossPaise,
    commissionPaise,
    payablePaise,
  };
};

module.exports = { calculateCommission };

const getMissingReferenceIssues = ({
  bookingPayments = [],
  ledger = null,
  ledgerPaymentExists = true,
}) => {
  const issues = [];

  if (bookingPayments.length === 0) {
    issues.push({
      code: "MISSING_PAYMENT_RECORD",
      message:
        "Completed booking has no local payment record. Verify Razorpay evidence before attempting any repair.",
    });
//   } else if (ledger && !ledgerPaymentExists) {
  }

  if (ledger && !ledgerPaymentExists) {
    issues.push({
      code: "MISSING_LEDGER_PAYMENT_REFERENCE",
      message:
        "The financial ledger references a payment record that does not exist. Verify provider evidence before attempting any repair.",
    });
  }

  if (!ledger) {
    issues.push({
      code: "MISSING_LEDGER",
      message: "Completed booking has no financial ledger entry.",
    });
  }

  return {
    result: "REVIEW_REQUIRED",
    providerCheck: "NOT_CHECKED",
    issues,
    manualReviewRequired: true,
  };
};

module.exports = {
  getMissingReferenceIssues,
};

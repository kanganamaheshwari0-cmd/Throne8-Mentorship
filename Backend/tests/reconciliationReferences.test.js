
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getMissingReferenceIssues,
} = require("../utils/reconciliationReferences");

test("missing payment and ledger require manual review", () => {
  const result = getMissingReferenceIssues({
    bookingPayments: [],
    ledger: null,
    ledgerPaymentExists: false,
  });

  assert.equal(result.result, "REVIEW_REQUIRED");
  assert.equal(result.providerCheck, "NOT_CHECKED");
  assert.equal(result.manualReviewRequired, true);

  assert.ok(
    result.issues.some(
      (issue) => issue.code === "MISSING_PAYMENT_RECORD"
    )
  );

  assert.ok(
    result.issues.some(
      (issue) => issue.code === "MISSING_LEDGER"
    )
  );
});

test("missing ledger payment reference requires manual review", () => {
  const result = getMissingReferenceIssues({
    bookingPayments: [{ _id: "payment-1" }],
    ledger: { paymentId: "deleted-payment" },
    ledgerPaymentExists: false,
  });

  assert.equal(result.result, "REVIEW_REQUIRED");
  assert.equal(result.manualReviewRequired, true);

  assert.ok(
    result.issues.some(
      (issue) =>
        issue.code === "MISSING_LEDGER_PAYMENT_REFERENCE"
    )
  );
});

test("existing payment and ledger do not create missing-reference issues", () => {
  const result = getMissingReferenceIssues({
    bookingPayments: [{ _id: "payment-1" }],
    ledger: { paymentId: "payment-1" },
    ledgerPaymentExists: true,
  });

  assert.deepEqual(result.issues, []);
  assert.equal(result.result, "REVIEW_REQUIRED");
});

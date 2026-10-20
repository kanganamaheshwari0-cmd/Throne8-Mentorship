
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compareRefundRecords,
} = require("../utils/refundReconciliation");

test("matching provider and local refund returns no issues", () => {
  const issues = compareRefundRecords({
    providerRefunds: [
      { id: "rfnd_123", amount: 70000, status: "processed" },
    ],
    localRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 70000,
        status: "PROCESSED",
      },
    ],
    embeddedRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 70000,
        status: "PROCESSED",
      },
    ],
  });

  assert.deepEqual(issues, []);
});

test("detects refund amount mismatch", () => {
  const issues = compareRefundRecords({
    providerRefunds: [
      { id: "rfnd_123", amount: 70000, status: "processed" },
    ],
    localRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 60000,
        status: "PROCESSED",
      },
    ],
  });

  assert.ok(issues.some((item) => item.code === "REFUND_AMOUNT_MISMATCH"));
});

test("detects refund status mismatch", () => {
  const issues = compareRefundRecords({
    providerRefunds: [
      { id: "rfnd_123", amount: 70000, status: "processed" },
    ],
    localRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 70000,
        status: "PROCESSING",
      },
    ],
  });

  assert.ok(issues.some((item) => item.code === "REFUND_STATUS_MISMATCH"));
});

test("detects provider refund missing locally", () => {
  const issues = compareRefundRecords({
    providerRefunds: [
      { id: "rfnd_provider", amount: 70000, status: "processed" },
    ],
  });

  assert.ok(
    issues.some((item) => item.code === "PROVIDER_REFUND_MISSING_LOCALLY")
  );
});

test("detects local refund missing at provider", () => {
  const issues = compareRefundRecords({
    localRefunds: [
      {
        gatewayRefundId: "rfnd_local",
        amountPaise: 70000,
        status: "PROCESSED",
      },
    ],
  });

  assert.ok(
    issues.some((item) => item.code === "LOCAL_REFUND_MISSING_AT_PROVIDER")
  );
});

test("detects disagreement between separate and embedded refund records", () => {
  const issues = compareRefundRecords({
    localRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 70000,
        status: "PROCESSED",
      },
    ],
    embeddedRefunds: [
      {
        gatewayRefundId: "rfnd_123",
        amountPaise: 60000,
        status: "PROCESSING",
      },
    ],
  });

  assert.ok(
    issues.some((item) => item.code === "LOCAL_REFUND_RECORD_MISMATCH")
  );
});

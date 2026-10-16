
const assert = require("node:assert/strict");

const {
  calculateEligibilityDate,
  isPayoutEligible,
} = require("../services/payoutEligibilityService");

const completedAt = "2026-01-01T10:30:00.000Z";
const eligibleAt = new Date("2026-01-16T10:30:00.000Z");

// Test 1: Exactly 15 days calculate hon.
assert.equal(
  calculateEligibilityDate(completedAt).toISOString(),
  eligibleAt.toISOString()
);

// Test 2: Eligibility se 1 millisecond pehle false.
assert.equal(
  isPayoutEligible({
    sessionCompletedAt: completedAt,
    now: new Date(eligibleAt.getTime() - 1),
  }),
  false
);

// Test 3: Eligibility ke exact time par true.
assert.equal(
  isPayoutEligible({
    sessionCompletedAt: completedAt,
    now: eligibleAt,
  }),
  true
);

// Test 4: Active dispute hone par false.
assert.equal(
  isPayoutEligible({
    sessionCompletedAt: completedAt,
    now: eligibleAt,
    hasActiveDispute: true,
  }),
  false
);

// Test 5: Refund pending hone par false.
assert.equal(
  isPayoutEligible({
    sessionCompletedAt: completedAt,
    now: eligibleAt,
    refundPending: true,
  }),
  false
);

// Test 6: Invalid completion date reject honi chahiye.
assert.throws(() => {
  calculateEligibilityDate("invalid-date");
});

// Test 7: Invalid current date reject honi chahiye.
assert.throws(() => {
  isPayoutEligible({
    sessionCompletedAt: completedAt,
    now: "invalid-date",
  });
});

console.log("All 7 payout eligibility tests passed.");

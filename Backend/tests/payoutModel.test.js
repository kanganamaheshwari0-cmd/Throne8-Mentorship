const test = require("node:test");
const assert = require("node:assert/strict");
const Payout = require("../models/Payout");

test("Payout model enforces one payout per booking with a unique index", () => {
  const bookingIndex = Payout.schema.indexes().find(
    ([keys, options]) =>
      keys.bookingId === 1 && options.unique === true
  );

  assert.ok(bookingIndex, "bookingId must have a unique index");
});

test("Payout model requires mentor, booking, amount, and eligibility date", () => {
  const requiredFields = [
    "mentorId",
    "bookingId",
    "amountPaise",
    "payoutEligibleAt",
  ];

  for (const field of requiredFields) {
    assert.equal(
      Payout.schema.path(field).isRequired,
      true,
      `${field} must be required`
    );
  }
});

test("Payout model only permits INR currency", () => {
  const currencyPath = Payout.schema.path("currency");

  assert.ok(currencyPath.enumValues.includes("INR"));
  assert.equal(currencyPath.enumValues.includes("USD"), false);
});

test("Payout amount must be a positive safe integer in paise", () => {
  const amountPath = Payout.schema.path("amountPaise");

  assert.equal(amountPath.options.min, 1);
  assert.equal(
    amountPath.validators.some(
      (validator) =>
        validator.type === "user defined" &&
        validator.validator(Number.MAX_SAFE_INTEGER)
    ),
    true
  );
});

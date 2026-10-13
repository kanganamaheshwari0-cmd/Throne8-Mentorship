const LedgerEntry = require("../models/LedgerEntry");

const validateAmount = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer in paise`);
  }
};

const createLines = async ({ base, lines, eventKeyPrefix }) => {
  const debit = lines
    .filter((line) => line.direction === "DEBIT")
    .reduce((sum, line) => sum + line.amountPaise, 0);

  const credit = lines
    .filter((line) => line.direction === "CREDIT")
    .reduce((sum, line) => sum + line.amountPaise, 0);

  if (debit !== credit) {
    throw new Error("Ledger entries are not balanced");
  }

  let created = 0;

  for (const line of lines) {
    const eventKey =
      `${eventKeyPrefix}:${line.account}:${line.direction}`;

    try {
      await LedgerEntry.create({
        ...base,
        ...line,
        eventKey,
      });

      created++;
    } catch (error) {
      if (error.code === 11000) {
        // Unique eventKey pehle se hai.
        // Kisi aur database error ko duplicate nahi maana jayega.
        const existing = await LedgerEntry.findOne({ eventKey });

        if (existing) continue;
      }

      throw error;
    }
  }

  return { created, total: lines.length };
};

// Captured payment ki balanced ledger entries.
const recordPaymentCaptured = async ({ booking, payment }) => {
  if (!booking || !payment) {
    throw new Error("Booking and payment are required");
  }

  if (payment.status !== "CAPTURED") {
    throw new Error("Only a CAPTURED payment can be recorded");
  }

  if (
    !booking._id ||
    !payment._id ||
    payment.amountPaise !== booking.pricePaise ||
    payment.currency !== booking.currency
  ) {
    throw new Error("Payment does not match booking");
  }

  const total = booking.pricePaise;
  const commission = booking.commissionPaise;
  const mentorShare = booking.mentorGrossPaise;

  validateAmount(total, "Total");
  validateAmount(commission, "Commission");
  validateAmount(mentorShare, "Mentor share");

  if (total < 1 || commission + mentorShare !== total) {
    throw new Error("Commission and mentor share do not add up");
  }

  const lines = [
    {
      account: "GATEWAY_CLEARING",
      direction: "DEBIT",
      amountPaise: total,
    },
    {
      account: "PLATFORM_COMMISSION",
      direction: "CREDIT",
      amountPaise: commission,
    },
    {
      account: "MENTOR_PAYABLE",
      direction: "CREDIT",
      amountPaise: mentorShare,
    },
  ].filter((line) => line.amountPaise > 0);

  return createLines({
    base: {
      bookingId: booking._id,
      paymentId: payment._id,
      eventType: "PAYMENT_CAPTURED",
      currency: payment.currency,
    },
    lines,
    eventKeyPrefix: `PAYMENT_CAPTURED:${payment._id}`,
  });
};

// Successful refund ki reversing ledger entries.
const recordRefundSucceeded = async ({
  booking,
  payment,
  refund,
  commissionPart,
  mentorPart,
}) => {
  if (!booking || !payment || !refund) {
    throw new Error("Booking, payment and refund are required");
  }

  if (
    !booking._id ||
    !payment._id ||
    !refund._id ||
    refund.paymentId.toString() !== payment._id.toString() ||
    refund.bookingId.toString() !== booking._id.toString()
  ) {
    throw new Error("Refund, payment and booking do not match");
  }

  validateAmount(refund.amountPaise, "Refund amount");
  validateAmount(commissionPart, "Commission reversal");
  validateAmount(mentorPart, "Mentor reversal");

  if (
    refund.status !== "SUCCEEDED" ||
    refund.amountPaise < 1 ||
    commissionPart + mentorPart !== refund.amountPaise
  ) {
    throw new Error("Refund status or refund split is invalid");
  }

  const lines = [
    {
      account: "PLATFORM_COMMISSION",
      direction: "DEBIT",
      amountPaise: commissionPart,
    },
    {
      account: "MENTOR_PAYABLE",
      direction: "DEBIT",
      amountPaise: mentorPart,
    },
    {
      account: "REFUND_CLEARING",
      direction: "CREDIT",
      amountPaise: refund.amountPaise,
    },
  ].filter((line) => line.amountPaise > 0);

  return createLines({
    base: {
      bookingId: booking._id,
      paymentId: payment._id,
      eventType: "REFUND_SUCCEEDED",
      currency: payment.currency,
    },
    lines,
    eventKeyPrefix: `REFUND_SUCCEEDED:${refund._id}`,
  });
};

// Ledger error ko log karo taaki reconciliation mein pakda ja sake.
const tryRecordPaymentCaptured = async ({ booking, payment }) => {
  try {
    return await recordPaymentCaptured({ booking, payment });
  } catch (error) {
    console.error(
      "LEDGER_ENTRY_FAILED",
      JSON.stringify({
        bookingId: booking?._id?.toString(),
        paymentId: payment?._id?.toString(),
        error: error.message,
      })
    );

    return null;
  }
};

module.exports = {
  recordPaymentCaptured,
  recordRefundSucceeded,
  tryRecordPaymentCaptured,
};
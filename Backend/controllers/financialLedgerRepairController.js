
const Razorpay = require("razorpay");

const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const FinancialLedger = require("../models/FinancialLedger");

const {
  ensureFinancialLedger,
} = require("./paymentController");

// Safely compare MongoDB ObjectIds and string IDs.
const sameId = (a, b) =>
  a != null &&
  b != null &&
  String(a) === String(b);

const getRazorpayInstance = () => {
  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    throw new Error(
      "Razorpay environment variables are missing"
    );
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const repairMissingFinancialLedgers = async (req, res) => {
  try {
    const razorpay = getRazorpayInstance();

    // Only captured payments with a capture timestamp
    // are eligible for financial ledger repair.
    const payments = await Payment.find({
      gateway: "razorpay",
      status: "CAPTURED",
      capturedAt: { $ne: null },
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(20)
      .lean();

    const results = [];

    for (const payment of payments) {
      try {
        // First, check whether a ledger already exists
        // for this payment OR its booking.
        const existingLedger =
          await FinancialLedger.findOne({
            $or: [
              { paymentId: payment._id },
              { bookingId: payment.bookingId },
            ],
          }).lean();

        if (existingLedger) {
          const bookingMatches = sameId(
            existingLedger.bookingId,
            payment.bookingId
          );

          const paymentMatches = sameId(
            existingLedger.paymentId,
            payment._id
          );

          if (!bookingMatches || !paymentMatches) {
            results.push({
              paymentId: String(payment._id),
              ledgerId: String(existingLedger._id),
              result: "REVIEW_REQUIRED",
              reason:
                "Existing ledger conflicts with this payment or booking.",
              conflicts: {
                bookingMatches,
                paymentMatches,
              },
            });

            continue;
          }

          results.push({
            paymentId: String(payment._id),
            ledgerId: String(existingLedger._id),
            result: "SKIPPED",
            reason:
              "A matching ledger already exists; no duplicate was created.",
          });

          continue;
        }

        // Load and verify the related booking.
        const booking = await Booking.findById(
          payment.bookingId
        ).lean();

        if (!booking) {
          results.push({
            paymentId: String(payment._id),
            result: "REVIEW_REQUIRED",
            reason:
              "The booking associated with this payment was not found.",
          });

          continue;
        }

        if (
          !sameId(booking._id, payment.bookingId) ||
          booking.pricePaise !== payment.amountPaise ||
          booking.currency !== payment.currency
        ) {
          results.push({
            paymentId: String(payment._id),
            result: "REVIEW_REQUIRED",
            reason:
              "The payment amount, currency or booking does not match.",
          });

          continue;
        }

        // Verify the payment directly with Razorpay.
        let providerPayment;

        if (payment.gatewayPaymentId) {
          providerPayment = await razorpay.payments.fetch(
            payment.gatewayPaymentId
          );
        } else {
          const orderPayments =
            await razorpay.orders.fetchPayments(
              payment.gatewayOrderId
            );

          const items = Array.isArray(orderPayments.items)
            ? orderPayments.items
            : [];

          const capturedPayments = items.filter(
            (item) => item.status === "captured"
          );

          // Never guess which payment belongs to the record.
          if (capturedPayments.length !== 1) {
            results.push({
              paymentId: String(payment._id),
              result: "REVIEW_REQUIRED",
              reason:
                "Exactly one captured payment could not be identified for this order.",
            });

            continue;
          }

          providerPayment = capturedPayments[0];
        }

        if (
          !providerPayment ||
          providerPayment.status !== "captured" ||
          providerPayment.order_id !==
            payment.gatewayOrderId ||
          providerPayment.amount !== payment.amountPaise ||
          providerPayment.currency !== payment.currency ||
          (
            payment.gatewayPaymentId &&
            providerPayment.id !== payment.gatewayPaymentId
          )
        ) {
          results.push({
            paymentId: String(payment._id),
            result: "REVIEW_REQUIRED",
            reason:
              "Razorpay payment details could not be verified against the local record.",
          });

          continue;
        }

        // Recheck immediately before creating a ledger.
        // Another request might have created one while
        // the Razorpay verification was in progress.
        const ledgerAfterProviderCheck =
          await FinancialLedger.findOne({
            $or: [
              { paymentId: payment._id },
              { bookingId: payment.bookingId },
            ],
          }).lean();

        if (ledgerAfterProviderCheck) {
          const bookingMatches = sameId(
            ledgerAfterProviderCheck.bookingId,
            payment.bookingId
          );

          const paymentMatches = sameId(
            ledgerAfterProviderCheck.paymentId,
            payment._id
          );

          if (!bookingMatches || !paymentMatches) {
            results.push({
              paymentId: String(payment._id),
              ledgerId: String(
                ledgerAfterProviderCheck._id
              ),
              result: "REVIEW_REQUIRED",
              reason:
                "A conflicting ledger was found during the final check.",
              conflicts: {
                bookingMatches,
                paymentMatches,
              },
            });

            continue;
          }

          results.push({
            paymentId: String(payment._id),
            ledgerId: String(
              ledgerAfterProviderCheck._id
            ),
            result: "SKIPPED",
            reason:
              "A matching ledger already exists; no duplicate was created.",
          });

          continue;
        }

        // Create the ledger only after all checks pass.
        const ledger = await ensureFinancialLedger(
          booking,
          payment
        );

        if (!ledger || !ledger._id) {
          throw new Error(
            "Financial ledger creation returned no ledger."
          );
        }

        // Confirm that the returned ledger belongs to
        // the exact booking and payment being repaired.
        const bookingMatches = sameId(
          ledger.bookingId,
          payment.bookingId
        );

        const paymentMatches = sameId(
          ledger.paymentId,
          payment._id
        );

        if (!bookingMatches || !paymentMatches) {
          results.push({
            paymentId: String(payment._id),
            ledgerId: String(ledger._id),
            result: "REVIEW_REQUIRED",
            reason:
              "The returned ledger does not match the expected payment and booking.",
            conflicts: {
              bookingMatches,
              paymentMatches,
            },
          });

          continue;
        }

        results.push({
          paymentId: String(payment._id),
          ledgerId: String(ledger._id),
          result: "REPAIRED",
          ledgerStatus: ledger.status,
        });
      } catch (error) {
        console.error(
          "Financial ledger repair item error:",
          String(payment._id),
          error.message
        );

        results.push({
          paymentId: String(payment._id),
          result: "REVIEW_REQUIRED",
          reason:
            "Repair was not completed. Check server logs and reconciliation.",
        });
      }
    }

    // Calculate counts from the final results so that
    // counters cannot become inconsistent.
    const repaired = results.filter(
      (item) => item.result === "REPAIRED"
    ).length;

    const skipped = results.filter(
      (item) => item.result === "SKIPPED"
    ).length;

    const reviewRequired = results.filter(
      (item) => item.result === "REVIEW_REQUIRED"
    ).length;

    return res.status(200).json({
      success: true,
      message:
        "Financial ledger repair run completed.",
      checked: results.length,
      repaired,
      skipped,
      reviewRequired,
      results,
    });
  } catch (error) {
    console.error(
      "Financial ledger repair error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to run financial ledger repair.",
    });
  }
};

module.exports = {
  repairMissingFinancialLedgers,
};

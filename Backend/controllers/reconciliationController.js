
const Razorpay = require("razorpay");
const LedgerEntry = require("../models/LedgerEntry");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const FinancialLedger = require("../models/FinancialLedger");
const Refund = require("../models/Refund");
const {
  getMissingReferenceIssues,
} = require("../utils/reconciliationReferences");

const {
  compareRefundRecords,
} = require("../utils/refundReconciliation");

const getRazorpayInstance = () => {
  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    throw new Error("Razorpay environment variables are missing");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const getProviderRefunds = async (razorpay, paymentId) => {
  const result = await razorpay.payments.fetchMultipleRefund(
    paymentId,
    { count: 100 }
  );

  return Array.isArray(result.items) ? result.items : [];
};

const getAdminReconciliation = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    // Load payments so missing references can be detected.
    const payments = await Payment.find()
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const completedBookings = await Booking.find({
      status: "COMPLETED",
      completedAt: { $ne: null },
    })
      .select("_id pricePaise currency completedAt createdAt")
      .lean();

    const paymentsById = new Map(
      payments.map((payment) => [
        String(payment._id),
        payment,
      ])
    );

    const paymentsByBookingId = new Map();

    for (const payment of payments) {
      const key = String(payment.bookingId);

      if (!paymentsByBookingId.has(key)) {
        paymentsByBookingId.set(key, []);
      }

      paymentsByBookingId.get(key).push(payment);
    }

    // Detect completed bookings with missing payment or ledger references.
    const missingResults = [];

    for (const booking of completedBookings) {
      const bookingPayments =
        paymentsByBookingId.get(String(booking._id)) || [];

      const ledger = await FinancialLedger.findOne({
        bookingId: booking._id,
      }).lean();

      const ledgerPaymentExists =
        ledger && paymentsById.has(String(ledger.paymentId));

      const hasMissingPaymentReference =
            bookingPayments.length === 0 ||
            !ledger ||
            !ledgerPaymentExists;

      if (!hasMissingPaymentReference) {
        continue;
      }

        const missingReferenceCheck = getMissingReferenceIssues({
        bookingPayments,
        ledger,
        ledgerPaymentExists: Boolean(ledgerPaymentExists),
      });

      const issues = [...missingReferenceCheck.issues];

      if (ledger) {
        if (ledger.studentPaidPaise !== booking.pricePaise) {
          issues.push({
            code: "BOOKING_LEDGER_AMOUNT_MISMATCH",
            message:
              "Completed booking amount differs from the ledger amount.",
          });
        }

        if (ledger.currency !== booking.currency) {
          issues.push({
            code: "BOOKING_LEDGER_CURRENCY_MISMATCH",
            message:
              "Completed booking currency differs from the ledger currency.",
          });
        }
      }

      missingResults.push({
        paymentId: ledger?.paymentId
          ? String(ledger.paymentId)
          : null,
        bookingId: String(booking._id),
        gatewayOrderId: null,
        gatewayPaymentId: null,
        localStatus: "MISSING",
        providerStatus: null,
        amountPaise: booking.pricePaise,
        currency: booking.currency,
        localRefundCount: 0,
        providerRefundCount: 0,
        ledgerFound: Boolean(ledger),
        providerCheck: "NOT_CHECKED",
        result: "REVIEW_REQUIRED",
        issues,
        reportDate: booking.completedAt || booking.createdAt,
      });
    }

    // Combine both record types before pagination.
    const combinedRows = [
      ...payments.map((payment) => ({
        type: "PAYMENT",
        reportDate: payment.createdAt,
        payment,
      })),
      ...missingResults.map((item) => ({
        type: "MISSING",
        reportDate: item.reportDate,
        item,
      })),
    ].sort(
      (a, b) =>
        new Date(b.reportDate || 0).getTime() -
        new Date(a.reportDate || 0).getTime()
    );

    const total = combinedRows.length;
    const totalPages = Math.ceil(total / limit);

    const pageRows = combinedRows.slice(
      (page - 1) * limit,
      page * limit
    );

    // Only actual payment records are checked against Razorpay.
    const pageResults = await Promise.all(
      pageRows.map(async (row) => {
        if (row.type === "MISSING") {
          const { reportDate, ...item } = row.item;
          return item;
        }

        const payment = row.payment;

        const booking = await Booking.findById(payment.bookingId)
          .select("_id status")
          .lean();

        const issues = [];
        let providerPayment = null;
        let providerRefunds = [];
        let providerCheck = "NOT_CHECKED";

        const ledger = await FinancialLedger.findOne({
          paymentId: payment._id,
        }).lean();

        const localRefunds = await Refund.find({
          paymentId: payment._id,
        }).lean();

        // Read-only validation of captured-payment double-entry lines.
        if (payment.status === "CAPTURED" && ledger) {
          const expectedLines = [
            {
              account: "GATEWAY_CLEARING",
              direction: "DEBIT",
              amountPaise: payment.amountPaise,
            },
            {
              account: "PLATFORM_COMMISSION",
              direction: "CREDIT",
              amountPaise: ledger.platformCommissionPaise,
            },
            {
              account: "MENTOR_PAYABLE",
              direction: "CREDIT",
              amountPaise: ledger.mentorEarningsPaise,
            },
          ].filter((line) => line.amountPaise > 0);

          const expectedDebit = expectedLines
            .filter((line) => line.direction === "DEBIT")
            .reduce((sum, line) => sum + line.amountPaise, 0);

          const expectedCredit = expectedLines
            .filter((line) => line.direction === "CREDIT")
            .reduce((sum, line) => sum + line.amountPaise, 0);

          const actualLines = await LedgerEntry.find({
            paymentId: payment._id,
            eventType: "PAYMENT_CAPTURED",
          }).lean();

          const actualDebit = actualLines
            .filter((line) => line.direction === "DEBIT")
            .reduce((sum, line) => sum + line.amountPaise, 0);

          const actualCredit = actualLines
            .filter((line) => line.direction === "CREDIT")
            .reduce((sum, line) => sum + line.amountPaise, 0);

          const lineMatches = (expected) =>
            actualLines.some(
              (actual) =>
                sameId(actual.bookingId, payment.bookingId) &&
                sameId(actual.paymentId, payment._id) &&
                actual.account === expected.account &&
                actual.direction === expected.direction &&
                actual.amountPaise === expected.amountPaise &&
                actual.currency === payment.currency &&
                actual.eventKey ===
                  `PAYMENT_CAPTURED:${payment._id}:${expected.account}:${expected.direction}`
            );

          const missingLines = expectedLines.filter(
            (expected) => !lineMatches(expected)
          );

          const hasUnexpectedLines = actualLines.some(
            (actual) =>
              !expectedLines.some(
                (expected) =>
                  actual.account === expected.account &&
                  actual.direction === expected.direction &&
                  actual.amountPaise === expected.amountPaise &&
                  sameId(actual.bookingId, payment.bookingId) &&
                  actual.currency === payment.currency &&
                  actual.eventKey ===
                    `PAYMENT_CAPTURED:${payment._id}:${expected.account}:${expected.direction}`
              )
          );

          if (
            missingLines.length > 0 ||
            hasUnexpectedLines ||
            actualDebit !== actualCredit ||
            actualDebit !== expectedDebit ||
            actualCredit !== expectedCredit
          ) {
            issues.push({
              code: "LEDGER_ENTRIES_INCOMPLETE_OR_UNBALANCED",
              message:
                "Double-entry ledger lines are missing, inconsistent, or unbalanced.",
              details: {
                expectedLineCount: expectedLines.length,
                actualLineCount: actualLines.length,
                missingLines: missingLines.map((line) => ({
                  account: line.account,
                  direction: line.direction,
                  amountPaise: line.amountPaise,
                })),
                hasUnexpectedLines,
                debitPaise: actualDebit,
                creditPaise: actualCredit,
              },
            });
          }
        }

        const isExpiredUnpaidOrder =
          booking?.status === "EXPIRED" &&
          payment.status === "CREATED" &&
          !payment.gatewayPaymentId &&
          !ledger &&
          localRefunds.length === 0;

        // if (isExpiredUnpaidOrder) {
        //   return {
        //     paymentId: String(payment._id),
        //     bookingId: String(payment.bookingId),
        //     gatewayOrderId: payment.gatewayOrderId,
        //     gatewayPaymentId: null,
        //     localStatus: payment.status,
        //     providerStatus: null,
        //     amountPaise: payment.amountPaise,
        //     currency: payment.currency,
        //     localRefundCount: 0,
        //     providerRefundCount: 0,
        //     ledgerFound: false,
        //     providerCheck: "NOT_REQUIRED",
        //     result: "NOT_APPLICABLE",
        //     issues: [],
        //   };
        // }

        // Always verify the order with Razorpay before marking it
// NOT_APPLICABLE. An expired booking can still have a
// captured provider payment.

        if (!ledger && payment.status === "CAPTURED") {
          issues.push({
            code: "MISSING_LEDGER",
            message:
              "Captured payment has no financial ledger entry.",
          });
        }

        if (ledger) {
          if (!sameId(ledger.bookingId, payment.bookingId)) {
            issues.push({
              code: "BOOKING_ID_MISMATCH",
              message:
                "Payment and ledger reference different bookings.",
            });
          }

          if (ledger.studentPaidPaise !== payment.amountPaise) {
            issues.push({
              code: "AMOUNT_MISMATCH",
              message:
                "Payment amount and ledger amount do not match.",
            });
          }

          if (ledger.currency !== payment.currency) {
            issues.push({
              code: "CURRENCY_MISMATCH",
              message:
                "Payment and ledger currencies do not match.",
            });
          }

          if (
            ledger.platformCommissionPaise +
              ledger.mentorEarningsPaise !==
            ledger.studentPaidPaise
          ) {
            issues.push({
              code: "LEDGER_BREAKDOWN_MISMATCH",
              message:
                "Platform commission plus mentor earnings does not equal the student payment.",
            });
          }

          const expectedCommission = Math.round(
            (ledger.studentPaidPaise * ledger.commissionRateBps) /
              10000
          );

          if (
            ledger.platformCommissionPaise !== expectedCommission
          ) {
            issues.push({
              code: "COMMISSION_MISMATCH",
              message:
                "Recorded commission does not match the ledger commission rate.",
            });
          }
        }

        try {
          const razorpay = getRazorpayInstance();

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

            providerPayment =
              items.find((item) => item.status === "captured") ||
              items[0] ||
              null;
          }

          if (!providerPayment) {
            if (!isExpiredUnpaidOrder) {
              issues.push({
                code: "PROVIDER_PAYMENT_NOT_FOUND",
                message:
                  "No payment was found for this order in the provider response.",
              });
            }
          } else {
            if (
              providerPayment.order_id !== payment.gatewayOrderId
            ) {
              issues.push({
                code: "PROVIDER_ORDER_MISMATCH",
                message:
                  "Provider payment belongs to a different order.",
              });
            }

            if (
              providerPayment.amount !== payment.amountPaise
            ) {
              issues.push({
                code: "PROVIDER_AMOUNT_MISMATCH",
                message:
                  "Razorpay payment amount differs from the local payment amount.",
              });
            }

            if (
              providerPayment.currency !== payment.currency
            ) {
              issues.push({
                code: "PROVIDER_CURRENCY_MISMATCH",
                message:
                  "Razorpay payment currency differs from the local currency.",
              });
            }

            if (
              providerPayment.status === "captured" &&
              payment.status !== "CAPTURED"
            ) {
              issues.push({
                code: "CAPTURE_STATUS_MISMATCH",
                message:
                  "Razorpay reports a captured payment but the local status differs.",
              });
            }

            if (
              providerPayment.status !== "captured" &&
              payment.status === "CAPTURED"
            ) {
              issues.push({
                code: "LOCAL_CAPTURE_STATUS_MISMATCH",
                message:
                  "The local payment is captured but Razorpay does not report it as captured.",
              });
            }

            if (providerPayment.id) {
              providerRefunds = await getProviderRefunds(
                razorpay,
                providerPayment.id
              );

              // Compare provider refunds against both local sources.
              const refundComparisonIssues =
                compareRefundRecords({
                  providerRefunds,
                  localRefunds,
                  embeddedRefunds: payment.refunds || [],
                });

              issues.push(...refundComparisonIssues);

              const providerProcessedRefundPaise =
                providerRefunds
                  .filter((item) => item.status === "processed")
                  .reduce(
                    (sum, item) =>
                      sum + Number(item.amount || 0),
                    0
                  );

              const localProcessedRefundPaise =
                localRefunds
                  .filter((item) => item.status === "PROCESSED")
                  .reduce(
                    (sum, item) =>
                      sum + Number(item.amountPaise || 0),
                    0
                  );

              const embeddedProcessedRefundPaise = (
                payment.refunds || []
              )
                .filter((item) => item.status === "PROCESSED")
                .reduce(
                  (sum, item) =>
                    sum + Number(item.amountPaise || 0),
                  0
                );

              if (
                localProcessedRefundPaise !==
                embeddedProcessedRefundPaise
              ) {
                issues.push({
                  code: "LOCAL_REFUND_TOTAL_MISMATCH",
                  message:
                    "The separate refund records and embedded payment refund records have different processed totals.",
                });
              }

              if (
                providerProcessedRefundPaise !==
                localProcessedRefundPaise
              ) {
                issues.push({
                  code: "PROVIDER_REFUND_TOTAL_MISMATCH",
                  message:
                    "Provider and separate local refund records have different processed totals.",
                });
              }

              if (
                Number(payment.refundedAmountPaise || 0) !==
                providerProcessedRefundPaise
              ) {
                issues.push({
                  code: "REFUNDED_AMOUNT_MISMATCH",
                  message:
                    "The payment's recorded refunded amount differs from the provider's processed refund total.",
                });
              }
            }
          }

          providerCheck = "COMPLETED";
        } catch (error) {
          providerCheck = "FAILED";

          issues.push({
            code: "PROVIDER_CHECK_FAILED",
            message:
              "Unable to verify this payment or its refunds with Razorpay. Check credentials, connectivity and provider response.",
          });
        }

        const result =
          providerCheck === "FAILED"
            ? "CHECK_FAILED"
            : booking?.status === "EXPIRED" &&
                payment.status === "CREATED" &&
                !payment.gatewayPaymentId &&
                !ledger &&
                localRefunds.length === 0 &&
                !providerPayment
              ? "NOT_APPLICABLE"
              : issues.length > 0
                ? "REVIEW_REQUIRED"
                : "MATCHED";

        return {
          paymentId: String(payment._id),
          bookingId: String(payment.bookingId),
          gatewayOrderId: payment.gatewayOrderId,
          gatewayPaymentId:
            payment.gatewayPaymentId ||
            providerPayment?.id ||
            null,
          localStatus: payment.status,
          providerStatus: providerPayment?.status || null,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          localRefundCount: localRefunds.length,
          providerRefundCount: providerRefunds.length,
          ledgerFound: Boolean(ledger),
          providerCheck,
          result,
          issues,
        };
      })
    );

       const summary = {
      scope: "CURRENT_PAGE",
      checked: pageResults.length,

      providerChecked: pageResults.filter(
        (item) => item.providerCheck === "COMPLETED"
      ).length,

      notChecked: pageResults.filter(
        (item) => item.providerCheck === "NOT_CHECKED"
      ).length,

      matched: pageResults.filter(
        (item) => item.result === "MATCHED"
      ).length,

      notApplicable: pageResults.filter(
        (item) => item.result === "NOT_APPLICABLE"
      ).length,

      reviewRequired: pageResults.filter(
        (item) => item.result === "REVIEW_REQUIRED"
      ).length,

      checkFailed: pageResults.filter(
        (item) => item.result === "CHECK_FAILED"
      ).length,

      missingReferences: pageResults.filter((item) =>
        (item.issues || []).some((issue) =>
          [
            "MISSING_PAYMENT_RECORD",
            "MISSING_LEDGER_PAYMENT_REFERENCE",
            "MISSING_LEDGER",
          ].includes(issue.code)
        )
      ).length,
    };

    return res.status(200).json({
      success: true,
      message: "Reconciliation report generated.",
      readOnly: true,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      results: pageResults,
    });
  } catch (error) {
    console.error(
      "Admin reconciliation error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to generate reconciliation report.",
    });
  }
};

module.exports = {
  getAdminReconciliation,
};




































































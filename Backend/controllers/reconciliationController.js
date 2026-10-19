
const Razorpay = require("razorpay");

const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const FinancialLedger = require("../models/FinancialLedger");
const Refund = require("../models/Refund");

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
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    // Load payment references so missing records can also be detected.
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
      payments.map((payment) => [String(payment._id), payment])
    );

    const paymentsByBookingId = new Map();

    for (const payment of payments) {
      const key = String(payment.bookingId);

      if (!paymentsByBookingId.has(key)) {
        paymentsByBookingId.set(key, []);
      }

      paymentsByBookingId.get(key).push(payment);
    }

    // Find completed bookings whose payment record or ledger payment
    // reference is missing. This report never creates payment records.
    const missingResults = [];

    for (const booking of completedBookings) {
      const bookingPayments =
        paymentsByBookingId.get(String(booking._id)) || [];

      const ledger = await FinancialLedger.findOne({
        bookingId: booking._id,
      }).lean();

  //     const booking = await Booking.findById(payment.bookingId)
  // .select("_id status")
  // .lean();

      const ledgerPaymentExists =
        ledger && paymentsById.has(String(ledger.paymentId));

      const hasMissingPaymentReference =
        bookingPayments.length === 0 ||
        (ledger && !ledgerPaymentExists);

      if (!hasMissingPaymentReference) {
        continue;
      }

      const issues = [
        {
          code: bookingPayments.length === 0
            ? "MISSING_PAYMENT_RECORD"
            : "MISSING_LEDGER_PAYMENT_REFERENCE",
          message: bookingPayments.length === 0
            ? "Completed booking has no local payment record. Verify Razorpay evidence before attempting any repair."
            : "The financial ledger references a payment record that does not exist. Verify provider evidence before attempting any repair.",
        },
      ];

      if (!ledger) {
        issues.push({
          code: "MISSING_LEDGER",
          message:
            "Completed booking has no financial ledger entry.",
        });
      }

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

    // Combine actual payments and missing-payment exceptions before
    // pagination so records are not skipped between pages.
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

    // Missing-payment exceptions are already flagged above.
    // Only actual Payment documents are checked against Razorpay.
    const razorpay = getRazorpayInstance();

    const pageResults = await Promise.all(
      pageRows.map(async (row) => {
        if (row.type === "MISSING") {
          const { reportDate, ...item } = row.item;
          return item;
        }

        const payment = row.payment;
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

        if (!ledger && payment.status === "CAPTURED") {
          issues.push({
            code: "MISSING_LEDGER",
            message: "Captured payment has no financial ledger entry.",
          });
        }

        if (ledger) {
          if (!sameId(ledger.bookingId, payment.bookingId)) {
            issues.push({
              code: "BOOKING_ID_MISMATCH",
              message: "Payment and ledger reference different bookings.",
            });
          }

          if (ledger.studentPaidPaise !== payment.amountPaise) {
            issues.push({
              code: "AMOUNT_MISMATCH",
              message: "Payment amount and ledger amount do not match.",
            });
          }

          if (ledger.currency !== payment.currency) {
            issues.push({
              code: "CURRENCY_MISMATCH",
              message: "Payment and ledger currencies do not match.",
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

          if (ledger.platformCommissionPaise !== expectedCommission) {
            issues.push({
              code: "COMMISSION_MISMATCH",
              message:
                "Recorded commission does not match the ledger commission rate.",
            });
          }
        }

        try {
          if (payment.gatewayPaymentId) {
            providerPayment = await razorpay.payments.fetch(
              payment.gatewayPaymentId
            );
          } else {
            const orderPayments = await razorpay.orders.fetchPayments(
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
  const isExpiredUnpaidOrder =
    booking?.status === "EXPIRED" &&
    payment.status === "CREATED" &&
    !payment.gatewayPaymentId &&
    !ledger &&
    localRefunds.length === 0;

  if (!isExpiredUnpaidOrder) {
    issues.push({
      code: "PROVIDER_PAYMENT_NOT_FOUND",
      message:
        "No payment was found for this order in the provider response.",
    });
  }
} else {

            if (providerPayment.order_id !== payment.gatewayOrderId) {
              issues.push({
                code: "PROVIDER_ORDER_MISMATCH",
                message:
                  "Provider payment belongs to a different order.",
              });
            }

            if (providerPayment.amount !== payment.amountPaise) {
              issues.push({
                code: "PROVIDER_AMOUNT_MISMATCH",
                message:
                  "Razorpay payment amount differs from the local payment amount.",
              });
            }

            if (providerPayment.currency !== payment.currency) {
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

              const providerRefundIds = new Set(
                providerRefunds.map((item) => item.id).filter(Boolean)
              );

              const localRefundIds = new Set([
                ...(payment.refunds || [])
                  .map((item) => item.gatewayRefundId)
                  .filter(Boolean),
                ...localRefunds
                  .map((item) => item.gatewayRefundId)
                  .filter(Boolean),
              ]);

              for (const refundId of providerRefundIds) {
                if (!localRefundIds.has(refundId)) {
                  issues.push({
                    code: "PROVIDER_REFUND_MISSING_LOCALLY",
                    message:
                      `Provider refund ${refundId} has no matching local refund ID.`,
                  });
                }
              }

              for (const refundId of localRefundIds) {
                if (!providerRefundIds.has(refundId)) {
                  issues.push({
                    code: "LOCAL_REFUND_MISSING_AT_PROVIDER",
                    message:
                      `Local refund ${refundId} was not found in the provider refund list.`,
                  });
                }
              }

              const providerProcessedRefundPaise = providerRefunds
                .filter((item) => item.status === "processed")
                .reduce(
                  (sum, item) => sum + Number(item.amount || 0),
                  0
                );

              const localProcessedRefundPaise = localRefunds
                .filter((item) => item.status === "PROCESSED")
                .reduce(
                  (sum, item) => sum + Number(item.amountPaise || 0),
                  0
                );

              const embeddedProcessedRefundPaise = (
                payment.refunds || []
              )
                .filter((item) => item.status === "PROCESSED")
                .reduce(
                  (sum, item) => sum + Number(item.amountPaise || 0),
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

        return {
          paymentId: String(payment._id),
          bookingId: String(payment.bookingId),
          gatewayOrderId: payment.gatewayOrderId,
          gatewayPaymentId:
            payment.gatewayPaymentId || providerPayment?.id || null,
          localStatus: payment.status,
          providerStatus: providerPayment?.status || null,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          localRefundCount: localRefunds.length,
          providerRefundCount: providerRefunds.length,
          ledgerFound: Boolean(ledger),
          providerCheck,
          result:
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
        : "MATCHED",
          issues,
        };
      })
    );

    const summary = {
  checked: pageResults.length,
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
    console.error("Admin reconciliation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to generate reconciliation report.",
    });
  }
};

module.exports = {
  getAdminReconciliation,
};

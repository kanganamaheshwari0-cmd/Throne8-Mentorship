
const Razorpay = require("razorpay");

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

    const total = await Payment.countDocuments();
    const payments = await Payment.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const razorpay = getRazorpayInstance();

    const results = await Promise.all(
      payments.map(async (payment) => {
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
            (ledger.studentPaidPaise * ledger.commissionRateBps) / 10000
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
            issues.push({
              code: "PROVIDER_PAYMENT_NOT_FOUND",
              message:
                "No payment was found for this order in the provider response.",
            });
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
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

              const localProcessedRefundPaise = localRefunds
                .filter((item) => item.status === "PROCESSED")
                .reduce((sum, item) => sum + Number(item.amountPaise || 0), 0);

              const embeddedProcessedRefundPaise = (
                payment.refunds || []
              )
                .filter((item) => item.status === "PROCESSED")
                .reduce((sum, item) => sum + Number(item.amountPaise || 0), 0);

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
              : issues.length > 0
                ? "REVIEW_REQUIRED"
                : "MATCHED",
          issues,
        };
      })
    );

    const summary = {
      checked: results.length,
      matched: results.filter((item) => item.result === "MATCHED").length,
      reviewRequired: results.filter(
        (item) => item.result === "REVIEW_REQUIRED"
      ).length,
      checkFailed: results.filter(
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
        totalPages: Math.ceil(total / limit),
      },
      results,
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

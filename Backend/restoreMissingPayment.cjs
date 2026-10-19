const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Razorpay = require("razorpay");

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  try {
    const db = mongoose.connection.db;
    const bookingId = new mongoose.Types.ObjectId("6acc75a57c10618ddd76b25e");
    const paymentMongoId = new mongoose.Types.ObjectId("6acc75b17c10618ddd76b25f");
    const orderId = "order_Tmt7r4HgkCT15k";
    const gatewayPaymentId = "pay_Tmt8v4N95Xg0PN";

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const [booking, ledger, existing] = await Promise.all([
      db.collection("bookings").findOne({ _id: bookingId }),
      db.collection("financialledgers").findOne({ bookingId }),
      db.collection("payments").findOne({
        $or: [
          { _id: paymentMongoId },
          { gatewayOrderId: orderId },
          { gatewayPaymentId }
        ]
      })
    ]);

    if (!booking || !ledger) throw new Error("Booking ya ledger missing hai.");
    if (existing) throw new Error("Matching Payment record already exists. Insert cancelled.");
    if (String(ledger.paymentId) !== String(paymentMongoId)) {
      throw new Error("Ledger paymentId mismatch. Insert cancelled.");
    }
    if (booking.status !== "COMPLETED" || booking.pricePaise !== 70000) {
      throw new Error("Booking status/amount mismatch. Insert cancelled.");
    }
    if (
      ledger.status !== "CONFIRMED" ||
      ledger.studentPaidPaise !== 70000 ||
      ledger.platformCommissionPaise !== 14000 ||
      ledger.mentorEarningsPaise !== 56000
    ) {
      throw new Error("Ledger values mismatch. Insert cancelled.");
    }

    const [payment, order] = await Promise.all([
      razorpay.payments.fetch(gatewayPaymentId),
      razorpay.orders.fetch(orderId)
    ]);

    if (
      payment.id !== gatewayPaymentId ||
      payment.order_id !== orderId ||
      payment.status !== "captured" ||
      payment.amount !== 70000 ||
      payment.currency !== "INR" ||
      payment.amount_refunded !== 0 ||
      order.id !== orderId ||
      order.status !== "paid" ||
      order.amount !== 70000 ||
      order.currency !== "INR" ||
      order.receipt !== "booking_" + String(bookingId)
    ) {
      throw new Error("Razorpay verification failed. Insert cancelled.");
    }

    const now = new Date();
    const capturedAt = payment.captured_at
      ? new Date(payment.captured_at * 1000)
      : ledger.capturedAt;

    if (!capturedAt) throw new Error("Captured timestamp unavailable. Insert cancelled.");

    await db.collection("payments").insertOne({
      _id: paymentMongoId,
      bookingId,
      gateway: "razorpay",
      gatewayOrderId: orderId,
      gatewayPaymentId,
      amountPaise: 70000,
      currency: "INR",
      status: "CAPTURED",
      capturedAt,
      refundedAmountPaise: 0,
      refunds: [],
      rawProviderRefs: {
        orderId,
        paymentId: gatewayPaymentId,
        restoredFromVerifiedRazorpay: true
      },
      createdAt: new Date(order.created_at * 1000),
      updatedAt: now,
      __v: 0
    });

    console.log("SUCCESS: Original Payment record restored.");
    console.log(JSON.stringify({
      mongoPaymentId: String(paymentMongoId),
      gatewayOrderId: orderId,
      gatewayPaymentId,
      amountPaise: 70000,
      status: "CAPTURED",
      ledgerChanged: false,
      payoutTransferred: false
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error("RESTORE STOPPED:", error.message);
  process.exitCode = 1;
});

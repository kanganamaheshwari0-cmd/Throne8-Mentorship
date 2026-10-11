
const WebhookEvent = require("../models/WebhookEvent");

const recordWebhookEvent = async ({
  eventId,
  eventType,
  payload,
}) => {
  if (!eventId || !eventType) {
    throw new Error("Webhook event ID and type are required");
  }

  try {
    const event = await WebhookEvent.create({
      gateway: "razorpay",
      eventId,
      eventType,
      payload,
      status: "RECEIVED",
    });

    return {
      duplicate: false,
      event,
    };
  } catch (error) {
    if (error.code === 11000) {
      const existingEvent = await WebhookEvent.findOne({
        gateway: "razorpay",
        eventId,
      });

      return {
        duplicate: true,
        event: existingEvent,
      };
    }

    throw error;
  }
};

module.exports = { recordWebhookEvent };
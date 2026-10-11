
import { useEffect, useState } from "react";
import api from "../services/api";
import "./Mentors.css";

const RAZORPAY_SCRIPT =
  "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener("error", () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

function getMentorName(mentor) {
  return mentor?.userId?.name || mentor?.name || "Mentor";
}

function getMentorExpertise(mentor) {
  if (Array.isArray(mentor?.expertise)) {
    return mentor.expertise.join(", ");
  }

  return mentor?.expertise || "Career guidance";
}

function getMentorPrice(mentor) {
  return (mentor?.sessionPricePaise || 0) / 100;
}

export default function Mentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMentor, setSelectedMentor] = useState(null);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  const [pendingBooking, setPendingBooking] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");

  useEffect(() => {
    const fetchMentors = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/mentors");
        const data = response.data;

        const mentorList = Array.isArray(data)
          ? data
          : data.mentors || data.data || [];

        setMentors(mentorList);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load mentors. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMentors();
  }, []);

  function openBookingForm(mentor) {
    setSelectedMentor(mentor);
    setSlotStart("");
    setSlotEnd("");
    setBookingError("");
    setBookingSuccess("");
    setPaymentError("");
    setPaymentSuccess("");
  }

  function closeBookingForm() {
    if (bookingLoading) return;

    setSelectedMentor(null);
    setSlotStart("");
    setSlotEnd("");
    setBookingError("");
  }

  async function handleBooking(event) {
    event.preventDefault();

    if (!selectedMentor) return;

    setBookingError("");
    setBookingSuccess("");
    setPaymentError("");
    setPaymentSuccess("");

    const start = new Date(slotStart);
    const end = new Date(slotEnd);

    if (
      !slotStart ||
      !slotEnd ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setBookingError("Please select both session times.");
      return;
    }

    if (start <= new Date()) {
      setBookingError("Session start time must be in the future.");
      return;
    }

    if (end <= start) {
      setBookingError("Session end time must be after start time.");
      return;
    }

    try {
      setBookingLoading(true);

      const response = await api.post("/bookings", {
        mentorId: selectedMentor._id,
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
      });

      const booking = response.data.booking;
      const id = booking?._id || response.data.bookingId;

      if (!id) {
        throw new Error(
          "Booking response did not contain a booking ID. Check the backend response."
        );
      }

      setPendingBooking({
        id,
        mentorName: getMentorName(selectedMentor),
        amount: getMentorPrice(selectedMentor),
      });

      setBookingSuccess(
        response.data.message ||
          "Booking created. Complete payment within 15 minutes."
      );

      setSelectedMentor(null);
      setSlotStart("");
      setSlotEnd("");
    } catch (err) {
      setBookingError(
        err.response?.data?.message ||
          err.message ||
          "Unable to create booking."
      );
    } finally {
      setBookingLoading(false);
    }
  }

  async function handlePayment() {
    if (!pendingBooking?.id || paymentLoading) return;

    setPaymentError("");
    setPaymentSuccess("");

    try {
      setPaymentLoading(true);

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Razorpay Checkout could not load. Check your internet connection."
        );
      }

      // Ask the backend to create or retrieve the Razorpay order.
      const orderResponse = await api.post(
        "/payments/create-order",
        {
          bookingId: pendingBooking.id,
        }
      );

      const order = orderResponse.data;

      if (!order.success || !order.orderId || !order.keyId) {
        throw new Error(
          order.message || "Unable to create payment order."
        );
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "THRONE8 Mentorship",
        description: `Mentorship session with ${pendingBooking.mentorName}`,
        order_id: order.orderId,

        handler: async function (paymentResponse) {
          try {
            setPaymentError("");

            const verificationResponse = await api.post(
              "/payments/verify",
              {
                bookingId: pendingBooking.id,
                razorpay_order_id:
                  paymentResponse.razorpay_order_id,
                razorpay_payment_id:
                  paymentResponse.razorpay_payment_id,
                razorpay_signature:
                  paymentResponse.razorpay_signature,
              }
            );

            const result = verificationResponse.data;

            if (
              result.success &&
              result.bookingStatus === "CONFIRMED" &&
              result.paymentStatus === "CAPTURED"
            ) {
              setPaymentSuccess(
                "Payment successful! Your mentorship booking is confirmed."
              );

              setBookingSuccess("");
              setPendingBooking(null);
            } else {
              setPaymentError(
                result.message ||
                  "Payment verification is not complete. Please check your payment status."
              );
            }
          } catch (err) {
            setPaymentError(
              err.response?.data?.message ||
                "Payment verification failed. Check your payment status before retrying."
            );
          }
        },

        modal: {
          ondismiss: function () {
            setPaymentError(
              "Checkout closed. Your booking may still be awaiting payment."
            );
          },
        },

        theme: {
          color: "#d7b779",
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", function (response) {
        setPaymentError(
          response.error?.description ||
            "Payment failed. Please try again."
        );
      });

      checkout.open();
    } catch (err) {
      setPaymentError(
        err.response?.data?.message ||
          err.message ||
          "Unable to start payment."
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  return (
    <main className="mentors-page">
      <section className="mentors-header">
        <p className="eyebrow">YOUR CAREER. YOUR FUTURE.</p>
        <h1>Find Your Mentor</h1>
        <p>
          Learn from experienced professionals and book a
          one-to-one mentorship session.
        </p>
      </section>

      {loading && <p>Loading mentors...</p>}

      {error && (
        <p className="mentors-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && mentors.length === 0 && (
        <p>No mentors are available right now.</p>
      )}

      {bookingSuccess && (
        <section className="payment-notice" aria-live="polite">
          <h2>Booking Created</h2>
          <p>{bookingSuccess}</p>

          {pendingBooking && (
            <>
              <p>
                Mentor: <strong>{pendingBooking.mentorName}</strong>
              </p>
              <p>
                Session fee:{" "}
                <strong>
                  ₹{pendingBooking.amount.toLocaleString("en-IN")}
                </strong>
              </p>
              <p>
                Complete payment within 15 minutes to confirm
                your booking.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? "Opening Checkout..." : "Pay Now"}
              </button>
            </>
          )}
        </section>
      )}

      {paymentError && (
        <p className="mentors-error" role="alert">
          {paymentError}
        </p>
      )}

      {paymentSuccess && (
        <section className="payment-notice" aria-live="polite">
          <h2>Payment Confirmed</h2>
          <p>{paymentSuccess}</p>
          <p>Your booking status is CONFIRMED.</p>
        </section>
      )}

      <section className="mentor-grid">
        {mentors.map((mentor) => (
          <article className="mentor-card" key={mentor._id}>
            <div className="mentor-card-content">
              <p className="eyebrow">
                {mentor.isVerified ? "VERIFIED MENTOR" : "MENTOR"}
              </p>

              <h2>{getMentorName(mentor)}</h2>

              <p className="mentor-expertise">
                {getMentorExpertise(mentor)}
              </p>

              {mentor.bio && <p>{mentor.bio}</p>}

              <p className="mentor-price">
                ₹{getMentorPrice(mentor).toLocaleString("en-IN")}
                <span> / session</span>
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openBookingForm(mentor)}
              >
                Book a Session
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedMentor && (
        <div
          className="booking-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeBookingForm();
            }
          }}
        >
          <section
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
          >
            <button
              type="button"
              className="booking-close"
              onClick={closeBookingForm}
              aria-label="Close booking form"
            >
              ×
            </button>

            <p className="eyebrow">BOOK YOUR SESSION</p>
            <h2 id="booking-title">
              {getMentorName(selectedMentor)}
            </h2>

            <p>
              Session fee:{" "}
              <strong>
                ₹{getMentorPrice(selectedMentor).toLocaleString("en-IN")}
              </strong>
            </p>

            <form onSubmit={handleBooking}>
              <label htmlFor="session-start">Session start</label>
              <input
                id="session-start"
                type="datetime-local"
                value={slotStart}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16)}
                onChange={(event) => setSlotStart(event.target.value)}
                required
              />

              <label htmlFor="session-end">Session end</label>
              <input
                id="session-end"
                type="datetime-local"
                value={slotEnd}
                min={slotStart || undefined}
                onChange={(event) => setSlotEnd(event.target.value)}
                required
              />

              {bookingError && (
                <p className="mentors-error" role="alert">
                  {bookingError}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={bookingLoading}
              >
                {bookingLoading ? "Creating Booking..." : "Confirm Booking"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

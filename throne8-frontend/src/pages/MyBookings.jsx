import "./MyBookings.css";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

function formatDate(date) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function MyBookings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingBookingId, setPayingBookingId] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/bookings/my");
      setBookings(response.data.bookings || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handlePayNow = async (booking) => {
    if (payingBookingId) return;

    setPayingBookingId(booking._id);
    setPaymentMessage("");
    setError("");

    try {
      // Load Razorpay Checkout
      const loaded = await loadRazorpayScript();

      if (!loaded) {
        throw new Error(
          "Razorpay Checkout could not load. Check your internet connection."
        );
      }

      // Ask backend to create or return the existing order
      const orderResponse = await api.post(
        "/payments/create-order",
        { bookingId: booking._id }
      );

      const order = orderResponse.data;

      if (
        !order.success ||
        !order.keyId ||
        !order.orderId ||
        !order.amount ||
        !order.currency
      ) {
        throw new Error(
          order.message || "Unable to initialize payment."
        );
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "THRONE8 Mentorship",
        description: "Mentorship session payment",
        order_id: order.orderId,

        handler: async (response) => {
          try {
            const verification = await api.post(
              "/payments/verify",
              {
                bookingId: booking._id,
                razorpay_order_id:
                  response.razorpay_order_id,
                razorpay_payment_id:
                  response.razorpay_payment_id,
                razorpay_signature:
                  response.razorpay_signature,
              }
            );

            if (verification.data.success) {
              setPaymentMessage(
                "Payment successful! Your booking is confirmed."
              );
              await fetchBookings();
            } else {
              setPaymentMessage(
                verification.data.message ||
                  "Payment verification needs attention. Check Payment History before retrying."
              );
              await fetchBookings();
            }
          } catch (err) {
            setPaymentMessage(
              err.response?.data?.message ||
                "Payment verification could not be completed. Check Payment History before retrying."
            );
            await fetchBookings();
          } finally {
            setPayingBookingId("");
          }
        },

        modal: {
          ondismiss: () => {
            setPayingBookingId("");
          },
        },

        theme: {
          color: "#b89b64",
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response) => {
        setPaymentMessage(
          response.error?.description ||
            "Payment failed. You can check Payment History."
        );
        setPayingBookingId("");
      });

      checkout.open();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to start payment."
      );
      setPayingBookingId("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="navbar">
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>

        <div className="nav-actions">
          <button
            className="btn btn-outline"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>

          <button
            className="btn btn-primary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-page">
        <section className="dashboard-welcome">
          <p className="eyebrow">STUDENT DASHBOARD</p>
          <h1>My Bookings</h1>
          <p>
            Welcome{user?.name ? `, ${user.name}` : ""}.
            Track your mentorship sessions here.
          </p>

          <button
            className="btn btn-outline"
            onClick={fetchBookings}
            disabled={loading || Boolean(payingBookingId)}
          >
            {loading ? "Refreshing..." : "Refresh Bookings"}
          </button>
        </section>

        {error && (
          <section className="dashboard-card">
            <p role="alert">{error}</p>
          </section>
        )}

        {paymentMessage && (
          <section className="dashboard-card">
            <p role="status">{paymentMessage}</p>
            <button
              className="btn btn-outline"
              onClick={() => navigate("/my-payments")}
            >
              View Payment History
            </button>
          </section>
        )}

        {loading ? (
          <p>Loading your bookings...</p>
        ) : !error && bookings.length === 0 ? (
          <section className="dashboard-card">
            <h2>No bookings yet</h2>
            <p>Explore mentors and book your first session.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/mentors")}
            >
              Explore Mentors
            </button>
          </section>
        ) : (
          !error && (
            <>
              <p>
                Total bookings: <strong>{bookings.length}</strong>
              </p>

              <section className="dashboard-grid">
                {bookings.map((booking) => {
                  const mentor = booking.mentorId;
                  const mentorName =
                    mentor?.userId?.name || "Mentor";
                  const expertise = mentor?.expertise || [];
                  const status = booking.status;

                  return (
                    <article
                      className="dashboard-card"
                      key={booking._id}
                    >
                      <p className="eyebrow">
                        MENTORSHIP SESSION
                      </p>

                      <h2>{mentorName}</h2>

                      <p>
                        <strong>Expertise:</strong>{" "}
                        {expertise.length
                          ? expertise.join(", ")
                          : "Not specified"}
                      </p>

                      <p>
                        <strong>Date:</strong>{" "}
                        {formatDate(booking.slotStart)}
                      </p>

                      <p>
                        <strong>Ends:</strong>{" "}
                        {formatDate(booking.slotEnd)}
                      </p>

                      <p>
                        <strong>Session fee:</strong>{" "}
                        ₹{(booking.pricePaise || 0) / 100}
                      </p>

                      <p>
                        <strong>Status:</strong>{" "}
                        <span
                          className={`status status-${status.toLowerCase()}`}
                        >
                          {status.replaceAll("_", " ")}
                        </span>
                      </p>

                      {status === "PENDING_PAYMENT" && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handlePayNow(booking)}
                          disabled={Boolean(payingBookingId)}
                        >
                          {payingBookingId === booking._id
                            ? "Processing..."
                            : "Pay Now"}
                        </button>
                      )}

                      <button
                        className="btn btn-outline"
                        onClick={() => navigate("/my-payments")}
                        disabled={Boolean(payingBookingId)}
                      >
                        View Payment History
                      </button>
                    </article>
                  );
                })}
              </section>
            </>
          )
        )}
      </main>

      <footer>
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>
        <p>Empowering your journey through mentorship.</p>
        <p>© 2026 THRONE8 Mentorship</p>
      </footer>
    </div>
  );
}

export default MyBookings;

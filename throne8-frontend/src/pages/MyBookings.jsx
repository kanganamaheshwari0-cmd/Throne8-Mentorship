import "./MyBookings.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

function formatDate(date) {
  if (!date) return "Not scheduled";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "Date unavailable";

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.data?.bookings)) return data.data.bookings;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getMentorDetails(booking) {
  const mentor =
    booking?.mentorId ||
    booking?.mentor ||
    booking?.tutor ||
    booking?.mentorDetails;

  const user =
    mentor?.userId ||
    mentor?.user ||
    mentor?.profile ||
    {};

  const name =
    user?.name ||
    user?.fullName ||
    mentor?.name ||
    mentor?.fullName ||
    booking?.mentorName;

  const rawExpertise =
    mentor?.expertise ||
    mentor?.skills ||
    booking?.mentorExpertise ||
    [];

  const expertise = Array.isArray(rawExpertise)
    ? rawExpertise.filter(Boolean)
    : typeof rawExpertise === "string"
      ? rawExpertise.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  return {
    name: name || "Mentor details unavailable",
    expertise,
  };
}

function formatCurrencyFromPaise(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return `₹${(amount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusLabel(status) {
  return String(status || "PENDING")
    .toUpperCase()
    .replaceAll("_", " ");
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
      setBookings(getList(response.data));
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load your bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const bookingStats = useMemo(() => {
    const stats = {
      total: bookings.length,
      completed: 0,
      confirmed: 0,
      expired: 0,
    };

    bookings.forEach((booking) => {
      const status = String(booking.status || "").toUpperCase();

      if (status === "COMPLETED") stats.completed += 1;
      if (status === "CONFIRMED") stats.confirmed += 1;
      if (status === "EXPIRED") stats.expired += 1;
    });

    return stats;
  }, [bookings]);

  const handlePayNow = async (booking) => {
    if (payingBookingId) return;

    setPayingBookingId(booking._id);
    setPaymentMessage("");
    setError("");

    try {
      const loaded = await loadRazorpayScript();

      if (!loaded) {
        throw new Error(
          "Razorpay Checkout could not load. Check your internet connection."
        );
      }

      const orderResponse = await api.post("/payments/create-order", {
        bookingId: booking._id,
      });

      const order = orderResponse.data;

      if (
        !order.success ||
        !order.keyId ||
        !order.orderId ||
        !order.amount ||
        !order.currency
      ) {
        throw new Error(order.message || "Unable to initialize payment.");
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "THRONE8 Mentorship",
        description: "Mentorship session payment",
        order_id: order.orderId,

        handler: async (response) => {
          try {
            const verification = await api.post("/payments/verify", {
              bookingId: booking._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setPaymentMessage(
              verification.data.success
                ? "Payment successful! Your booking is confirmed."
                : verification.data.message ||
                    "Payment verification needs attention. Check Payment History before retrying."
            );

            await fetchBookings();
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
          ondismiss: () => setPayingBookingId(""),
        },

        theme: { color: "#b89b64" },
      });

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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  return (
    <div className="app mb-page">
      <header className="navbar mb-navbar">
        <Link className="logo mb-logo" to="/">
          THRONE<span>8</span>
        </Link>

        <nav className="mb-nav-links">
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>

        <div className="nav-actions mb-nav-actions">
          <button
            className="btn btn-outline"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>

          <button className="btn btn-primary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="mb-main">
        <section className="mb-hero">
          <div className="mb-hero-copy">
            <p className="mb-eyebrow">
              <span className="mb-eyebrow-dot" />
              STUDENT PORTAL
            </p>

            <h1>My Bookings<span>.</span></h1>

            <p className="mb-hero-description">
              Welcome{user?.name ? `, ${user.name}` : ""}. Keep track of your
              mentorship journey, upcoming sessions and booking history.
            </p>
          </div>

          <button
            className="mb-refresh-button"
            onClick={fetchBookings}
            disabled={loading || Boolean(payingBookingId)}
          >
            <span aria-hidden="true">↻</span>
            {loading ? "Refreshing..." : "Refresh bookings"}
          </button>
        </section>

        {error && (
          <div className="mb-alert mb-alert-error" role="alert">
            <span className="mb-alert-icon">!</span>
            <div>
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
            <button onClick={fetchBookings} disabled={loading}>
              Try again
            </button>
          </div>
        )}

        {paymentMessage && (
          <div className="mb-alert mb-alert-success" role="status">
            <span className="mb-alert-icon">✓</span>
            <div>
              <strong>Payment update</strong>
              <p>{paymentMessage}</p>
            </div>
            <button onClick={() => navigate("/my-payments")}>
              Payment history
            </button>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <section className="mb-stats-grid" aria-label="Booking statistics">
            <article className="mb-stat-card mb-stat-total">
              <div className="mb-stat-top">
                <span className="mb-stat-icon">▤</span>
                <span className="mb-stat-caption">ALL SESSIONS</span>
              </div>
              <p className="mb-stat-number">{bookingStats.total}</p>
              <p className="mb-stat-label">Total bookings</p>
            </article>

            <article className="mb-stat-card">
              <div className="mb-stat-top">
                <span className="mb-stat-icon mb-icon-completed">✓</span>
                <span className="mb-stat-caption">FINISHED</span>
              </div>
              <p className="mb-stat-number">{bookingStats.completed}</p>
              <p className="mb-stat-label">Completed sessions</p>
            </article>

            <article className="mb-stat-card">
              <div className="mb-stat-top">
                <span className="mb-stat-icon mb-icon-confirmed">◷</span>
                <span className="mb-stat-caption">UPCOMING / ACTIVE</span>
              </div>
              <p className="mb-stat-number">{bookingStats.confirmed}</p>
              <p className="mb-stat-label">Confirmed sessions</p>
            </article>

            <article className="mb-stat-card">
              <div className="mb-stat-top">
                <span className="mb-stat-icon mb-icon-expired">↗</span>
                <span className="mb-stat-caption">INACTIVE</span>
              </div>
              <p className="mb-stat-number">{bookingStats.expired}</p>
              <p className="mb-stat-label">Expired bookings</p>
            </article>
          </section>
        )}

        <section className="mb-bookings-section">
          <div className="mb-section-heading">
            <div>
              <p className="mb-eyebrow">YOUR MENTORSHIP</p>
              <h2>Session overview</h2>
            </div>

            {!loading && !error && bookings.length > 0 && (
              <span className="mb-results-count">
                {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="mb-state-card" aria-live="polite">
              <div className="mb-loader" />
              <h3>Loading your bookings</h3>
              <p>Getting your latest mentorship sessions...</p>
            </div>
          ) : error ? null : bookings.length === 0 ? (
            <div className="mb-state-card">
              <div className="mb-empty-icon">▤</div>
              <h3>Your journey starts here</h3>
              <p>
                You haven't booked a mentorship session yet. Find a mentor and
                take your next step.
              </p>
              <button
                className="mb-primary-button"
                onClick={() => navigate("/mentors")}
              >
                Explore mentors <span>→</span>
              </button>
            </div>
          ) : (
            <div className="mb-bookings-grid">
              {bookings.map((booking) => {
                const { name: mentorName, expertise } =
                  getMentorDetails(booking);

                const status = String(
                  booking.status || "PENDING"
                ).toUpperCase();

                const statusClass = status.toLowerCase().replaceAll("_", "-");

                return (
                  <article className="mb-booking-card" key={booking._id}>
                    <div className="mb-card-topline">
                      <span className="mb-session-label">
                        <span className="mb-session-dot" />
                        MENTORSHIP SESSION
                      </span>

                      <span className={`mb-status-badge mb-status-${statusClass}`}>
                        <span className="mb-status-dot" />
                        {getStatusLabel(status)}
                      </span>
                    </div>

                    <div className="mb-mentor-block">
                      <div className="mb-mentor-avatar" aria-hidden="true">
                        {mentorName !== "Mentor details unavailable"
                          ? mentorName.charAt(0).toUpperCase()
                          : "M"}
                      </div>

                      <div className="mb-mentor-info">
                        <h3>{mentorName}</h3>
                        <p>Your mentorship partner</p>
                      </div>
                    </div>

                    <div className="mb-expertise-block">
                      <p className="mb-detail-label">AREAS OF EXPERTISE</p>
                      <div className="mb-expertise-tags">
                        {expertise.length > 0 ? (
                          expertise.map((skill, index) => (
                            <span className="mb-expertise-tag" key={`${skill}-${index}`}>
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="mb-muted-text">Not specified</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-card-divider" />

                    <div className="mb-session-details">
                      <div className="mb-detail-row">
                        <span className="mb-detail-icon" aria-hidden="true">▦</span>
                        <div>
                          <p className="mb-detail-label">SESSION START</p>
                          <p className="mb-detail-value">
                            {formatDate(booking.slotStart)}
                          </p>
                        </div>
                      </div>

                      <div className="mb-detail-row">
                        <span className="mb-detail-icon" aria-hidden="true">◷</span>
                        <div>
                          <p className="mb-detail-label">SESSION END</p>
                          <p className="mb-detail-value">
                            {formatDate(booking.slotEnd)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-card-footer">
                      <div className="mb-fee-block">
                        <p className="mb-detail-label">SESSION FEE</p>
                        <p className="mb-fee-amount">
                          {booking.pricePaise != null
                            ? formatCurrencyFromPaise(booking.pricePaise)
                            : "—"}
                        </p>
                      </div>

                      <div className="mb-card-actions">
                        {status === "PENDING_PAYMENT" && (
                          <button
                            className="mb-primary-button mb-pay-button"
                            onClick={() => handlePayNow(booking)}
                            disabled={Boolean(payingBookingId)}
                          >
                            {payingBookingId === booking._id
                              ? "Processing..."
                              : "Pay now"}
                          </button>
                        )}

                        <button
                          className="mb-history-button"
                          onClick={() => navigate("/my-payments")}
                          disabled={Boolean(payingBookingId)}
                        >
                          Payment history <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-help-strip">
          <div className="mb-help-symbol">i</div>
          <div>
            <h3>Need help with a booking?</h3>
            <p>
              Review your payment records or return to your dashboard to
              continue managing your mentorship journey.
            </p>
          </div>
          <button
            className="mb-help-link"
            onClick={() => navigate("/dashboard")}
          >
            Go to dashboard <span>→</span>
          </button>
        </section>
      </main>

      <footer className="mb-footer">
        <div className="mb-footer-inner">
          <div>
            <Link className="logo mb-logo" to="/">
              THRONE<span>8</span>
            </Link>
            <p>Empowering your journey through mentorship.</p>
          </div>
          <p className="mb-copyright">
            © {new Date().getFullYear()} THRONE8 Mentorship
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MyBookings;

// import "./MyBookings.css";
// import { useCallback, useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// function formatDate(date) {
//   if (!date) return "Not scheduled";

//   const parsed = new Date(date);
//   if (Number.isNaN(parsed.getTime())) return "Date unavailable";

//   return parsed.toLocaleString("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   });
// }

// function getList(data) {
//   if (Array.isArray(data)) return data;
//   if (Array.isArray(data?.bookings)) return data.bookings;
//   if (Array.isArray(data?.data?.bookings)) return data.data.bookings;
//   if (Array.isArray(data?.data)) return data.data;
//   return [];
// }

// function getMentorDetails(booking) {
//   const mentor =
//     booking?.mentorId ||
//     booking?.mentor ||
//     booking?.tutor ||
//     booking?.mentorDetails;

//   const user =
//     mentor?.userId ||
//     mentor?.user ||
//     mentor?.profile ||
//     {};

//   const name =
//     user?.name ||
//     user?.fullName ||
//     mentor?.name ||
//     mentor?.fullName ||
//     booking?.mentorName ||
//     booking?.mentor?.name;

//   const rawExpertise =
//     mentor?.expertise ||
//     mentor?.skills ||
//     booking?.mentorExpertise ||
//     [];

//   const expertise = Array.isArray(rawExpertise)
//     ? rawExpertise
//     : typeof rawExpertise === "string"
//       ? rawExpertise.split(",").map((item) => item.trim()).filter(Boolean)
//       : [];

//   return {
//     name: name || "Mentor details unavailable",
//     expertise,
//   };
// }

// function formatCurrencyFromPaise(value) {
//   const amount = Number(value);

//   if (!Number.isFinite(amount)) return "—";

//   return `₹${(amount / 100).toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function loadRazorpayScript() {
//   return new Promise((resolve) => {
//     if (window.Razorpay) {
//       resolve(true);
//       return;
//     }

//     const script = document.createElement("script");
//     script.src = "https://checkout.razorpay.com/v1/checkout.js";
//     script.onload = () => resolve(true);
//     script.onerror = () => resolve(false);
//     document.body.appendChild(script);
//   });
// }

// function MyBookings() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [bookings, setBookings] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [payingBookingId, setPayingBookingId] = useState("");
//   const [paymentMessage, setPaymentMessage] = useState("");

//   const fetchBookings = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const response = await api.get("/bookings/my");
//       setBookings(getList(response.data));
//     } catch (err) {
//       setError(
//         err.response?.data?.message || "Unable to load your bookings."
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchBookings();
//   }, [fetchBookings]);

//   const handlePayNow = async (booking) => {
//     if (payingBookingId) return;

//     setPayingBookingId(booking._id);
//     setPaymentMessage("");
//     setError("");

//     try {
//       const loaded = await loadRazorpayScript();

//       if (!loaded) {
//         throw new Error(
//           "Razorpay Checkout could not load. Check your internet connection."
//         );
//       }

//       const orderResponse = await api.post("/payments/create-order", {
//         bookingId: booking._id,
//       });

//       const order = orderResponse.data;

//       if (
//         !order.success ||
//         !order.keyId ||
//         !order.orderId ||
//         !order.amount ||
//         !order.currency
//       ) {
//         throw new Error(order.message || "Unable to initialize payment.");
//       }

//       const checkout = new window.Razorpay({
//         key: order.keyId,
//         amount: order.amount,
//         currency: order.currency,
//         name: "THRONE8 Mentorship",
//         description: "Mentorship session payment",
//         order_id: order.orderId,

//         handler: async (response) => {
//           try {
//             const verification = await api.post("/payments/verify", {
//               bookingId: booking._id,
//               razorpay_order_id: response.razorpay_order_id,
//               razorpay_payment_id: response.razorpay_payment_id,
//               razorpay_signature: response.razorpay_signature,
//             });

//             setPaymentMessage(
//               verification.data.success
//                 ? "Payment successful! Your booking is confirmed."
//                 : verification.data.message ||
//                     "Payment verification needs attention. Check Payment History before retrying."
//             );

//             await fetchBookings();
//           } catch (err) {
//             setPaymentMessage(
//               err.response?.data?.message ||
//                 "Payment verification could not be completed. Check Payment History before retrying."
//             );
//             await fetchBookings();
//           } finally {
//             setPayingBookingId("");
//           }
//         },

//         modal: {
//           ondismiss: () => setPayingBookingId(""),
//         },

//         theme: { color: "#b89b64" },
//       });

//       checkout.on("payment.failed", (response) => {
//         setPaymentMessage(
//           response.error?.description ||
//             "Payment failed. You can check Payment History."
//         );
//         setPayingBookingId("");
//       });

//       checkout.open();
//     } catch (err) {
//       setError(
//         err.response?.data?.message ||
//           err.message ||
//           "Unable to start payment."
//       );
//       setPayingBookingId("");
//     }
//   };

//   const handleLogout = async () => {
//     try {
//       await logout();
//     } finally {
//       navigate("/login");
//     }
//   };

//   return (
//     <div className="app">
//       <header className="navbar">
//         <Link className="logo" to="/">
//           THRONE<span>8</span>
//         </Link>

//         <nav>
//           <Link to="/">Home</Link>
//           <Link to="/dashboard">Dashboard</Link>
//         </nav>

//         <div className="nav-actions">
//           <button
//             className="btn btn-outline"
//             onClick={() => navigate("/dashboard")}
//           >
//             Dashboard
//           </button>

//           <button className="btn btn-primary" onClick={handleLogout}>
//             Logout
//           </button>
//         </div>
//       </header>

//       <main className="dashboard-page">
//         <section className="dashboard-welcome">
//           <p className="eyebrow">STUDENT DASHBOARD</p>
//           <h1>My Bookings</h1>
//           <p>
//             Welcome{user?.name ? `, ${user.name}` : ""}. Track your mentorship
//             sessions here.
//           </p>

//           <button
//             className="btn btn-outline"
//             onClick={fetchBookings}
//             disabled={loading || Boolean(payingBookingId)}
//           >
//             {loading ? "Refreshing..." : "Refresh Bookings"}
//           </button>
//         </section>

//         {error && (
//           <section className="dashboard-card">
//             <p role="alert">{error}</p>
//           </section>
//         )}

//         {paymentMessage && (
//           <section className="dashboard-card">
//             <p role="status">{paymentMessage}</p>
//             <button
//               className="btn btn-outline"
//               onClick={() => navigate("/my-payments")}
//             >
//               View Payment History
//             </button>
//           </section>
//         )}

//         {loading ? (
//           <p>Loading your bookings...</p>
//         ) : error ? null : bookings.length === 0 ? (
//           <section className="dashboard-card">
//             <h2>No bookings yet</h2>
//             <p>Explore mentors and book your first session.</p>
//             <button
//               className="btn btn-primary"
//               onClick={() => navigate("/mentors")}
//             >
//               Explore Mentors
//             </button>
//           </section>
//         ) : (
//           <>
//             <p>
//               Total bookings: <strong>{bookings.length}</strong>
//             </p>

//             <section className="dashboard-grid">
//               {bookings.map((booking) => {
//                 const { name: mentorName, expertise } =
//                   getMentorDetails(booking);
//                 const status = String(booking.status || "PENDING").toUpperCase();

//                 return (
//                   <article className="dashboard-card" key={booking._id}>
//                     <p className="eyebrow">MENTORSHIP SESSION</p>

//                     <h2>{mentorName}</h2>

//                     <p>
//                       <strong>Expertise:</strong>{" "}
//                       {expertise.length
//                         ? expertise.join(", ")
//                         : "Not specified"}
//                     </p>

//                     <p>
//                       <strong>Date:</strong> {formatDate(booking.slotStart)}
//                     </p>

//                     <p>
//                       <strong>Ends:</strong> {formatDate(booking.slotEnd)}
//                     </p>

//                     <p>
//                       <strong>Session fee:</strong>{" "}
//                       {booking.pricePaise != null
//                         ? formatCurrencyFromPaise(booking.pricePaise)
//                         : "—"}
//                     </p>

//                     <p>
//                       <strong>Status:</strong>{" "}
//                       <span
//                         className={`status status-${status.toLowerCase()}`}
//                       >
//                         {status.replaceAll("_", " ")}
//                       </span>
//                     </p>

//                     {status === "PENDING_PAYMENT" && (
//                       <button
//                         className="btn btn-primary"
//                         onClick={() => handlePayNow(booking)}
//                         disabled={Boolean(payingBookingId)}
//                       >
//                         {payingBookingId === booking._id
//                           ? "Processing..."
//                           : "Pay Now"}
//                       </button>
//                     )}

//                     <button
//                       className="btn btn-outline"
//                       onClick={() => navigate("/my-payments")}
//                       disabled={Boolean(payingBookingId)}
//                     >
//                       View Payment History
//                     </button>
//                   </article>
//                 );
//               })}
//             </section>
//           </>
//         )}
//       </main>

//       <footer>
//         <Link className="logo" to="/">
//           THRONE<span>8</span>
//         </Link>
//         <p>Empowering your journey through mentorship.</p>
//         <p>© {new Date().getFullYear()} THRONE8 Mentorship</p>
//       </footer>
//     </div>
//   );
// }

// export default MyBookings;






























// import "./MyBookings.css";
// import { useCallback, useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// function formatDate(date) {
//   return new Date(date).toLocaleString("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   });
// }

// function loadRazorpayScript() {
//   return new Promise((resolve) => {
//     if (window.Razorpay) {
//       resolve(true);
//       return;
//     }

//     const script = document.createElement("script");
//     script.src = "https://checkout.razorpay.com/v1/checkout.js";
//     script.onload = () => resolve(true);
//     script.onerror = () => resolve(false);
//     document.body.appendChild(script);
//   });
// }

// function MyBookings() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [bookings, setBookings] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [payingBookingId, setPayingBookingId] = useState("");
//   const [paymentMessage, setPaymentMessage] = useState("");

//   const fetchBookings = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const response = await api.get("/bookings/my");
//       setBookings(response.data.bookings || []);
//     } catch (err) {
//       setError(
//         err.response?.data?.message ||
//           "Unable to load your bookings."
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchBookings();
//   }, [fetchBookings]);

//   const handlePayNow = async (booking) => {
//     if (payingBookingId) return;

//     setPayingBookingId(booking._id);
//     setPaymentMessage("");
//     setError("");

//     try {
//       // Load Razorpay Checkout
//       const loaded = await loadRazorpayScript();

//       if (!loaded) {
//         throw new Error(
//           "Razorpay Checkout could not load. Check your internet connection."
//         );
//       }

//       // Ask backend to create or return the existing order
//       const orderResponse = await api.post(
//         "/payments/create-order",
//         { bookingId: booking._id }
//       );

//       const order = orderResponse.data;

//       if (
//         !order.success ||
//         !order.keyId ||
//         !order.orderId ||
//         !order.amount ||
//         !order.currency
//       ) {
//         throw new Error(
//           order.message || "Unable to initialize payment."
//         );
//       }

//       const options = {
//         key: order.keyId,
//         amount: order.amount,
//         currency: order.currency,
//         name: "THRONE8 Mentorship",
//         description: "Mentorship session payment",
//         order_id: order.orderId,

//         handler: async (response) => {
//           try {
//             const verification = await api.post(
//               "/payments/verify",
//               {
//                 bookingId: booking._id,
//                 razorpay_order_id:
//                   response.razorpay_order_id,
//                 razorpay_payment_id:
//                   response.razorpay_payment_id,
//                 razorpay_signature:
//                   response.razorpay_signature,
//               }
//             );

//             if (verification.data.success) {
//               setPaymentMessage(
//                 "Payment successful! Your booking is confirmed."
//               );
//               await fetchBookings();
//             } else {
//               setPaymentMessage(
//                 verification.data.message ||
//                   "Payment verification needs attention. Check Payment History before retrying."
//               );
//               await fetchBookings();
//             }
//           } catch (err) {
//             setPaymentMessage(
//               err.response?.data?.message ||
//                 "Payment verification could not be completed. Check Payment History before retrying."
//             );
//             await fetchBookings();
//           } finally {
//             setPayingBookingId("");
//           }
//         },

//         modal: {
//           ondismiss: () => {
//             setPayingBookingId("");
//           },
//         },

//         theme: {
//           color: "#b89b64",
//         },
//       };

//       const checkout = new window.Razorpay(options);

//       checkout.on("payment.failed", (response) => {
//         setPaymentMessage(
//           response.error?.description ||
//             "Payment failed. You can check Payment History."
//         );
//         setPayingBookingId("");
//       });

//       checkout.open();
//     } catch (err) {
//       setError(
//         err.response?.data?.message ||
//           err.message ||
//           "Unable to start payment."
//       );
//       setPayingBookingId("");
//     }
//   };

//   const handleLogout = () => {
//     logout();
//     navigate("/login");
//   };

//   return (
//     <div className="app">
//       <header className="navbar">
//         <Link className="logo" to="/">
//           THRONE<span>8</span>
//         </Link>

//         <nav>
//           <Link to="/">Home</Link>
//           <Link to="/dashboard">Dashboard</Link>
//         </nav>

//         <div className="nav-actions">
//           <button
//             className="btn btn-outline"
//             onClick={() => navigate("/dashboard")}
//           >
//             Dashboard
//           </button>

//           <button
//             className="btn btn-primary"
//             onClick={handleLogout}
//           >
//             Logout
//           </button>
//         </div>
//       </header>

//       <main className="dashboard-page">
//         <section className="dashboard-welcome">
//           <p className="eyebrow">STUDENT DASHBOARD</p>
//           <h1>My Bookings</h1>
//           <p>
//             Welcome{user?.name ? `, ${user.name}` : ""}.
//             Track your mentorship sessions here.
//           </p>

//           <button
//             className="btn btn-outline"
//             onClick={fetchBookings}
//             disabled={loading || Boolean(payingBookingId)}
//           >
//             {loading ? "Refreshing..." : "Refresh Bookings"}
//           </button>
//         </section>

//         {error && (
//           <section className="dashboard-card">
//             <p role="alert">{error}</p>
//           </section>
//         )}

//         {paymentMessage && (
//           <section className="dashboard-card">
//             <p role="status">{paymentMessage}</p>
//             <button
//               className="btn btn-outline"
//               onClick={() => navigate("/my-payments")}
//             >
//               View Payment History
//             </button>
//           </section>
//         )}

//         {loading ? (
//           <p>Loading your bookings...</p>
//         ) : !error && bookings.length === 0 ? (
//           <section className="dashboard-card">
//             <h2>No bookings yet</h2>
//             <p>Explore mentors and book your first session.</p>
//             <button
//               className="btn btn-primary"
//               onClick={() => navigate("/mentors")}
//             >
//               Explore Mentors
//             </button>
//           </section>
//         ) : (
//           !error && (
//             <>
//               <p>
//                 Total bookings: <strong>{bookings.length}</strong>
//               </p>

//               <section className="dashboard-grid">
//                 {bookings.map((booking) => {
//                   const mentor = booking.mentorId;
//                   const mentorName =
//                     mentor?.userId?.name || "Mentor";
//                   const expertise = mentor?.expertise || [];
//                   const status = booking.status;

//                   return (
//                     <article
//                       className="dashboard-card"
//                       key={booking._id}
//                     >
//                       <p className="eyebrow">
//                         MENTORSHIP SESSION
//                       </p>

//                       <h2>{mentorName}</h2>

//                       <p>
//                         <strong>Expertise:</strong>{" "}
//                         {expertise.length
//                           ? expertise.join(", ")
//                           : "Not specified"}
//                       </p>

//                       <p>
//                         <strong>Date:</strong>{" "}
//                         {formatDate(booking.slotStart)}
//                       </p>

//                       <p>
//                         <strong>Ends:</strong>{" "}
//                         {formatDate(booking.slotEnd)}
//                       </p>

//                       <p>
//                         <strong>Session fee:</strong>{" "}
//                         ₹{(booking.pricePaise || 0) / 100}
//                       </p>

//                       <p>
//                         <strong>Status:</strong>{" "}
//                         <span
//                           className={`status status-${status.toLowerCase()}`}
//                         >
//                           {status.replaceAll("_", " ")}
//                         </span>
//                       </p>

//                       {status === "PENDING_PAYMENT" && (
//                         <button
//                           className="btn btn-primary"
//                           onClick={() => handlePayNow(booking)}
//                           disabled={Boolean(payingBookingId)}
//                         >
//                           {payingBookingId === booking._id
//                             ? "Processing..."
//                             : "Pay Now"}
//                         </button>
//                       )}

//                       <button
//                         className="btn btn-outline"
//                         onClick={() => navigate("/my-payments")}
//                         disabled={Boolean(payingBookingId)}
//                       >
//                         View Payment History
//                       </button>
//                     </article>
//                   );
//                 })}
//               </section>
//             </>
//           )
//         )}
//       </main>

//       <footer>
//         <Link className="logo" to="/">
//           THRONE<span>8</span>
//         </Link>
//         <p>Empowering your journey through mentorship.</p>
//         <p>© 2026 THRONE8 Mentorship</p>
//       </footer>
//     </div>
//   );
// }

// export default MyBookings;

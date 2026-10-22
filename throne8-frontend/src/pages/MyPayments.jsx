
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

const styles = `
.mp-page{min-height:100vh;background:#0e1024;color:#f4f4ff;font-family:Inter,system-ui,sans-serif}
.mp-page *{box-sizing:border-box}
.mp-page a{text-decoration:none;color:inherit}
.mp-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 28px;background:#171b36;border-bottom:1px solid #303654}
.mp-brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:850}
.mp-logo{display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:#8987ff;color:white}
.mp-header-actions{display:flex;gap:10px;flex-wrap:wrap}
.mp-btn{border:1px solid #454b75;border-radius:10px;padding:10px 14px;background:#202443;color:#f4f4ff;cursor:pointer;font:inherit}
.mp-btn:hover{background:#2c3158}
.mp-btn:disabled{opacity:.55;cursor:not-allowed}
.mp-primary{background:#8987ff;border-color:#8987ff;color:white}
.mp-primary:hover{background:#7774f0}
.mp-layout{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:calc(100vh - 73px)}
.mp-sidebar{padding:24px 14px;background:#0e1127;border-right:1px solid #303654}
.mp-side-title{padding:0 12px 12px;color:#7786b5;font-size:11px;font-weight:800;letter-spacing:1.3px}
.mp-nav{display:block;width:100%;padding:13px 12px;margin-bottom:5px;border:1px solid transparent;border-radius:10px;color:#aeb9e2}
.mp-nav:hover,.mp-nav.active{background:#252b50;border-color:#393f68;color:#b3b1ff}
.mp-main{width:100%;max-width:1450px;margin:0 auto;padding:34px;min-width:0}
.mp-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:25px}
.mp-eyebrow{color:#a5a3ff;font-size:11px;font-weight:800;letter-spacing:1.5px}
.mp-heading h1{font-size:30px;letter-spacing:-.7px;margin:8px 0}
.mp-muted{color:#9aa9d4;line-height:1.7}
.mp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:22px}
.mp-card{background:#171b36;border:1px solid #303654;border-radius:15px;padding:21px;min-width:0}
.mp-stat-label{font-size:13px;color:#9aa9d4}
.mp-stat-value{font-size:26px;font-weight:850;margin-top:10px;overflow-wrap:anywhere}
.mp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.mp-toolbar h2{font-size:19px;margin:0}
.mp-table-wrap{overflow-x:auto}
.mp-table{border-collapse:collapse;width:100%;min-width:650px;text-align:left;font-size:13px}
.mp-table th,.mp-table td{padding:15px 12px;border-bottom:1px solid #303654}
.mp-table th{color:#9aa9d4;font-size:11px;letter-spacing:.7px}
.mp-table td{color:#eef0ff}
.mp-id{max-width:180px;overflow-wrap:anywhere;color:#aeb9e2}
.mp-badge{display:inline-block;border-radius:20px;padding:5px 9px;background:#202c4d;color:#a9caff;font-size:11px;font-weight:750}
.mp-badge.green{background:#123328;color:#9af0c4}
.mp-badge.red{background:#3a1c2a;color:#ffb7c4}
.mp-badge.gold{background:#382d12;color:#ffce72}
.mp-message{padding:22px;border-radius:12px;background:#202443;color:#aeb9e2;line-height:1.7}
.mp-error{background:#3a1c2a;color:#ffb7c4}
.mp-footer{text-align:center;padding:23px;border-top:1px solid #242a46;color:#7781a7;font-size:12px;line-height:1.8}
@media(max-width:850px){.mp-layout{grid-template-columns:1fr}.mp-sidebar{display:flex;gap:6px;overflow-x:auto;padding:10px;border-right:0;border-bottom:1px solid #303654}.mp-side-title{display:none}.mp-nav{white-space:nowrap;width:auto;flex-shrink:0;margin:0}.mp-main{padding:24px 18px}}
@media(max-width:600px){.mp-header{padding:13px;flex-wrap:wrap}.mp-brand{font-size:19px}.mp-main{padding:20px 12px}.mp-heading{flex-direction:column}.mp-heading h1{font-size:26px}.mp-stats{grid-template-columns:1fr}.mp-card{padding:16px}}
`;

function getPayments(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.payments)) return data.data.payments;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function money(payment) {
  const raw = payment?.amountPaise ?? payment?.amount;
  if (raw === null || raw === undefined || raw === "") return "—";

  const value = Number(raw);
  if (!Number.isFinite(value)) return "—";

  // amountPaise is stored in paise; amount is shown as supplied by the API.
  const rupees = payment.amountPaise != null ? value / 100 : value;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: payment.currency || "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function badgeClass(status = "") {
  const value = String(status).toLowerCase();
  if (/captured|paid|success|completed/.test(value)) return "green";
  if (/failed|refund|dispute|reject/.test(value)) return "red";
  if (/created|pending|authorized|processing/.test(value)) return "gold";
  return "";
}

function bookingId(payment) {
  const booking = payment?.bookingId;
  if (booking && typeof booking === "object") {
    return booking._id || booking.id || "—";
  }
  return booking || "—";
}

export default function MyPayments() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/payments/my");
      setPayments(getPayments(response.data));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        "Unable to load your payment history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  const totalCapturedPaise = payments.reduce((total, payment) => {
    if (String(payment.status || "").toLowerCase() !== "captured") {
      return total;
    }

    const raw = payment.amountPaise ?? (
      payment.amount != null ? Number(payment.amount) * 100 : null
    );

    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? total + value : total;
  }, 0);

  return (
    <div className="mp-page">
      <style>{styles}</style>

      <header className="mp-header">
        <Link to="/" className="mp-brand">
          <span className="mp-logo">T8</span>
          <span>THRONE8</span>
        </Link>

        <div className="mp-header-actions">
          <button
            type="button"
            className="mp-btn"
            onClick={() => navigate("/dashboard")}
          >
            ← Student Dashboard
          </button>
          <button
            type="button"
            className="mp-btn"
            onClick={handleLogout}
          >
            Logout ↗
          </button>
        </div>
      </header>

      <div className="mp-layout">
        <aside className="mp-sidebar">
          <div className="mp-side-title">STUDENT WORKSPACE</div>
          <Link className="mp-nav" to="/dashboard">⌂ Dashboard</Link>
          <Link className="mp-nav" to="/mentors">⌕ Find Mentors</Link>
          <Link className="mp-nav" to="/my-bookings">▦ My Bookings</Link>
          <Link className="mp-nav active" to="/my-payments">₹ My Payments</Link>
          <Link className="mp-nav" to="/dashboard#student-profile">◎ My Profile</Link>
        </aside>

        <main className="mp-main">
          <div className="mp-heading">
            <div>
              <div className="mp-eyebrow">STUDENT PORTAL / PAYMENTS</div>
              <h1>My Payments</h1>
              <p className="mp-muted">
                {user?.name ? `Welcome, ${user.name}. ` : ""}
                Review your payment records and their current status.
              </p>
            </div>

            <button
              type="button"
              className="mp-btn mp-primary"
              onClick={fetchPayments}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>

          <section className="mp-stats">
            <article className="mp-card">
              <div className="mp-stat-label">Payment records</div>
              <div className="mp-stat-value">
                {loading ? "…" : payments.length}
              </div>
            </article>
            <article className="mp-card">
              <div className="mp-stat-label">Captured payments</div>
              <div className="mp-stat-value">
                {loading ? "…" : payments.filter(
                  (payment) =>
                    String(payment.status || "").toLowerCase() === "captured"
                ).length}
              </div>
            </article>
            <article className="mp-card">
              <div className="mp-stat-label">Total captured amount</div>
              <div className="mp-stat-value">
                {loading
                  ? "…"
                  : new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 2,
                    }).format(totalCapturedPaise / 100)}
              </div>
            </article>
          </section>

          {error && (
            <div className="mp-message mp-error" role="alert">
              <strong>Could not load payments.</strong>
              <p>{error}</p>
              <button
                type="button"
                className="mp-btn"
                onClick={fetchPayments}
                disabled={loading}
              >
                Try again
              </button>
            </div>
          )}

          <section className="mp-card" style={{ marginTop: 20 }}>
            <div className="mp-toolbar">
              <h2>Payment history</h2>
              <span className="mp-muted">
                {loading ? "Loading records…" : `${payments.length} record(s)`}
              </span>
            </div>

            {loading ? (
              <div className="mp-message">Loading your payment history…</div>
            ) : error ? (
              <div className="mp-message mp-error">
                Payment history could not be loaded. Use Refresh to try again.
              </div>
            ) : payments.length === 0 ? (
              <div className="mp-message">
                <strong>No payment records yet.</strong>
                <p>Your payment records will appear here when the API returns them.</p>
                <button
                  type="button"
                  className="mp-btn mp-primary"
                  onClick={() => navigate("/mentors")}
                >
                  Explore Mentors
                </button>
              </div>
            ) : (
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>AMOUNT</th>
                      <th>STATUS</th>
                      <th>BOOKING ID</th>
                      <th>PAYMENT ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment, index) => (
                      <tr key={payment._id || payment.id || index}>
                        <td>{formatDate(
                          payment.capturedAt ||
                          payment.createdAt ||
                          payment.updatedAt
                        )}</td>
                        <td><strong>{money(payment)}</strong></td>
                        <td>
                          <span className={`mp-badge ${badgeClass(payment.status)}`}>
                            {payment.status || "Unknown"}
                          </span>
                        </td>
                        <td className="mp-id">{bookingId(payment)}</td>
                        <td className="mp-id">{payment._id || payment.id || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="mp-muted" style={{ marginTop: 18, fontSize: 12 }}>
            Payment details reflect the records returned by THRONE8's payment API.
            Missing amounts and identifiers are shown as unavailable rather than invented.
          </p>
        </main>
      </div>

      <footer className="mp-footer">
        <strong>THRONE8</strong>
        <div>Empowering your journey through mentorship.</div>
        © {new Date().getFullYear()} THRONE8 Mentorship. All rights reserved.
      </footer>
    </div>
  );
}














// import { useCallback, useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// const sections = [
//   { id: "checkout", label: "Checkout" },
//   { id: "verifying", label: "Verifying payment" },
//   { id: "receipt", label: "Paid receipt" },
//   { id: "failed", label: "Payment failed" },
//   { id: "refund", label: "Refund status" },
// ];

// const styles = `
// *{box-sizing:border-box}
// .payment-ui{min-height:100vh;background:#0e1024;color:#f4f4ff;font-family:Inter,system-ui,sans-serif}
// .payment-ui button,.payment-ui a{font:inherit}
// .payment-ui a{text-decoration:none}
// .pu-header{height:76px;padding:14px 24px;background:#171b36;border-bottom:1px solid #303654;display:flex;align-items:center;justify-content:space-between;gap:16px}
// .pu-brand{display:flex;align-items:center;gap:11px;color:white;font-size:24px;font-weight:850}
// .pu-logo{width:39px;height:39px;display:grid;place-items:center;border-radius:11px;background:#8987ff;font-size:14px}
// .pu-sample{font-size:11px;color:#b7b4ff;background:#10152c;border-radius:20px;padding:8px 12px}
// .pu-roles{display:flex;gap:5px;background:#0e1127;padding:5px;border-radius:13px}
// .pu-roles a{padding:10px 15px;color:#aeb9e2;border-radius:9px;font-size:14px}
// .pu-roles a.active{background:#202443;color:white;border:1px solid #393f68}
// .pu-layout{display:grid;grid-template-columns:273px minmax(0,1fr);min-height:calc(100vh - 76px)}
// .pu-sidebar{background:#0e1127;border-right:1px solid #303654;padding:21px 13px}
// .pu-nav{width:100%;display:block;text-align:left;padding:13px 15px;margin-bottom:5px;border:1px solid transparent;border-radius:10px;background:transparent;color:#aeb9e2;cursor:pointer}
// .pu-nav:hover{background:#171c39;color:white}
// .pu-nav.active{background:#252b50;color:#9c9aff;font-weight:750}
// .pu-content{padding:38px 35px;min-width:0;max-width:1600px;width:100%;margin:0 auto}
// .pu-heading{margin-bottom:28px}
// .pu-heading h1{font-size:30px;letter-spacing:-.7px;margin:0 0 10px}
// .pu-heading p{font-size:15px;line-height:1.7;color:#91a4d6;margin:0}
// .pu-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.9fr);gap:20px;align-items:start}
// .pu-left{display:grid;gap:20px;min-width:0}
// .pu-card{background:#171b36;border:1px solid #303654;border-radius:16px;padding:25px;min-width:0}
// .pu-mentor{display:flex;align-items:center;gap:17px}
// .pu-avatar{width:55px;height:55px;display:grid;place-items:center;flex-shrink:0;border-radius:50%;background:#252b58;color:#9c9aff;font-weight:800;font-size:18px}
// .pu-mentor h2,.pu-summary h2{font-size:18px;margin:0 0 7px}
// .pu-mentor p{font-size:15px;color:#9bb0e2;margin:0}
// .pu-details{margin-top:20px}
// .pu-detail{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-bottom:1px dashed #303654}
// .pu-detail:last-child{border-bottom:0}
// .pu-detail span{color:#9bb0e2}
// .pu-detail strong{text-align:right;overflow-wrap:anywhere}
// .pu-summary h2{margin-bottom:22px}
// .pu-total{font-size:24px;font-weight:850}
// .pu-summary .pu-detail{font-size:14px}
// .pu-pay{width:100%;border:0;border-radius:12px;padding:14px;background:#8987ff;color:white;font-weight:750;cursor:pointer;margin-top:12px}
// .pu-pay:hover{background:#7774f0}
// .pu-pay:disabled{opacity:.6;cursor:not-allowed}
// .pu-note{font-size:13px;line-height:1.8;color:#91a4d6;margin:15px 0 0}
// .pu-alert{padding:16px 18px;background:#382d12;color:#ffbd35;border-radius:12px;line-height:1.7;font-size:14px}
// .pu-alert.blue{background:#142344;color:#9bc5ff}
// .pu-alert.green{background:#123328;color:#9af0c4}
// .pu-alert.red{background:#3a1c2a;color:#ffb7c4}
// .pu-state{text-align:center;padding:26px 10px}
// .pu-state-icon{font-size:42px;margin-bottom:15px}
// .pu-state h2{font-size:22px;margin:0 0 10px}
// .pu-state p{color:#aab7df;line-height:1.8;font-size:14px}
// .pu-btn{display:inline-block;padding:11px 15px;border:1px solid #4a4e7a;border-radius:10px;color:#dedcff;background:transparent;cursor:pointer;margin:6px}
// .pu-table-wrap{overflow-x:auto}
// .pu-table{border-collapse:collapse;width:100%;min-width:600px;text-align:left;font-size:13px}
// .pu-table th,.pu-table td{padding:14px 12px;border-bottom:1px solid #303654}
// .pu-table th{color:#9bb0e2}
// .pu-table td{color:#eef0ff}
// .pu-empty{padding:24px;text-align:center;color:#a0acce;font-size:13px;line-height:1.8}
// .pu-footer{padding:24px;text-align:center;border-top:1px solid #242a46;color:#777fa8;font-size:12px;line-height:1.8}
// @media(max-width:1000px){.pu-content{padding:28px 20px}.pu-grid{grid-template-columns:1fr}.pu-summary{max-width:none}}
// @media(max-width:700px){.pu-header{height:auto;flex-wrap:wrap;padding:13px 15px}.pu-brand{font-size:20px}.pu-roles{gap:0}.pu-roles a{padding:8px;font-size:12px}.pu-layout{grid-template-columns:1fr}.pu-sidebar{display:flex;overflow-x:auto;gap:6px;padding:10px;border-right:0;border-bottom:1px solid #303654}.pu-nav{white-space:nowrap;width:auto;flex-shrink:0;margin:0;padding:11px;font-size:12px}.pu-content{padding:24px 14px}.pu-heading h1{font-size:26px}.pu-card{padding:18px}.pu-detail{font-size:13px}}
// `;

// function getList(data) {
//   if (Array.isArray(data)) return data;
//   for (const key of ["payments", "data", "results"]) {
//     if (Array.isArray(data?.[key])) return data[key];
//   }
//   if (Array.isArray(data?.data?.payments)) return data.data.payments;
//   return [];
// }

// function formatDate(date) {
//   if (!date) return "Not available";
//   const parsed = new Date(date);
//   if (Number.isNaN(parsed.getTime())) return "Not available";
//   return parsed.toLocaleString("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   });
// }

// function statusClass(status = "") {
//   const value = String(status).toLowerCase();
//   if (/captured|paid|success|processed|completed/.test(value)) return "green";
//   if (/fail|refund|reject|dispute/.test(value)) return "red";
//   return "blue";
// }

// export default function MyPayments() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [payments, setPayments] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [section, setSection] = useState("checkout");

//   const fetchPayments = useCallback(async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const response = await api.get("/payments/my");
//       setPayments(getList(response.data));
//     } catch (err) {
//       setError(err?.response?.data?.message || "Unable to load your payment history.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchPayments();
//   }, [fetchPayments]);

//   const handleLogout = async () => {
//     try {
//       await logout();
//     } finally {
//       navigate("/login");
//     }
//   };

//   const latestPayment = payments[0];
//   const amount = latestPayment?.amountPaise != null
//     ? Number(latestPayment.amountPaise) / 100
//     : latestPayment?.amount != null ? Number(latestPayment.amount) : 1000;

//   const booking = latestPayment?.bookingId && typeof latestPayment.bookingId === "object"
//     ? latestPayment.bookingId : null;

//   const mentor = booking?.mentor && typeof booking.mentor === "object"
//     ? booking.mentor : null;

//   const mentorName = mentor?.name || mentor?.fullName || "Your selected mentor";
//   const bookingReference = booking?._id || latestPayment?.bookingId || "Shown after booking selection";
//   const sessionDate = booking?.slotStart || booking?.slotDate || booking?.sessionDate;

//   const pageTitle = {
//     checkout: "Checkout",
//     verifying: "Verifying payment",
//     receipt: "Paid receipt",
//     failed: "Payment failed",
//     refund: "Refund status",
//   }[section];

//   return (
//     <div className="payment-ui">
//       <style>{styles}</style>

//       <header className="pu-header">
//         <Link to="/" className="pu-brand">
//           <span className="pu-logo">T8</span>
//           <span>Throne8</span>
//           <span className="pu-sample">Prototype · UI preview</span>
//         </Link>
//         <nav className="pu-roles">
//           <Link to="/dashboard" className="active">Student</Link>
//           <Link to="/mentor-dashboard">Mentor</Link>
//           <Link to="/admin-dashboard">Admin</Link>
//         </nav>
//       </header>

//       <div className="pu-layout">
//         <aside className="pu-sidebar">
//           {sections.map((item) => (
//             <button
//               key={item.id}
//               type="button"
//               className={`pu-nav ${section === item.id ? "active" : ""}`}
//               onClick={() => setSection(item.id)}
//             >
//               {item.label}
//             </button>
//           ))}
//         </aside>

//         <main className="pu-content">
//           <div className="pu-heading">
//             <h1>{pageTitle}</h1>
//             <p>
//               {section === "checkout" && "Review your session and payment details."}
//               {section === "verifying" && "Check the current payment verification state."}
//               {section === "receipt" && "Review your available payment record."}
//               {section === "failed" && "Review the status of an unsuccessful payment."}
//               {section === "refund" && "Review any available refund information."}
//             </p>
//           </div>

//           {error && (
//             <div className="pu-alert red" style={{ marginBottom: 20 }}>
//               {error}
//               <button className="pu-btn" onClick={fetchPayments} disabled={loading}>
//                 Retry loading records
//               </button>
//             </div>
//           )}

//           {section === "checkout" && (
//             <div className="pu-grid">
//               <div className="pu-left">
//                 <section className="pu-card pu-mentor">
//                   <div className="pu-avatar">
//                     {(mentorName || "M").slice(0, 2).toUpperCase()}
//                   </div>
//                   <div>
//                     <h2>Session with {mentorName}</h2>
//                     <p>{booking?.topic || booking?.expertise || "Mentorship session"} · Session details</p>
//                   </div>
//                 </section>

//                 <section className="pu-card">
//                   <div className="pu-detail">
//                     <span>Date</span>
//                     <strong>{sessionDate ? formatDate(sessionDate) : "Selected booking date"}</strong>
//                   </div>
//                   <div className="pu-detail">
//                     <span>Time</span>
//                     <strong>{booking?.slotTime || "Selected booking time"}</strong>
//                   </div>
//                   <div className="pu-detail">
//                     <span>Booking ID</span>
//                     <strong>{String(bookingReference)}</strong>
//                   </div>
//                 </section>

//                 <div className="pu-alert">
//                   UI preview only. This screen does not reserve a slot or initiate a payment.
//                 </div>
//               </div>

//               <section className="pu-card pu-summary">
//                 <h2>Payment summary</h2>
//                 <div className="pu-detail">
//                   <span>Session fee</span>
//                   <strong>{latestPayment ? `₹${amount.toLocaleString("en-IN")}` : "—"}</strong>
//                 </div>
//                 <div className="pu-detail">
//                   <strong>Total</strong>
//                   <strong className="pu-total">{latestPayment ? `₹${amount.toLocaleString("en-IN")}` : "—"}</strong>
//                 </div>
//                 <button className="pu-pay" onClick={() => setSection("verifying")}>
//                   Preview verification screen
//                 </button>
//                 <p className="pu-note">
//                   Real payment checkout is not connected on this prototype screen. Use the existing booking checkout flow for actual payments.
//                 </p>
//               </section>
//             </div>
//           )}

//           {section === "verifying" && (
//             <section className="pu-card pu-state">
//               <div className="pu-state-icon">◌</div>
//               <h2>Payment verification preview</h2>
//               <p>This is a UI preview. No payment is being verified or submitted.</p>
//               <div className="pu-alert blue">Current available record: {latestPayment?.status || "No payment record loaded"}</div>
//               <button className="pu-btn" onClick={() => setSection("receipt")}>Preview receipt</button>
//               <button className="pu-btn" onClick={() => setSection("failed")}>Preview failure screen</button>
//             </section>
//           )}

//           {section === "receipt" && (
//             <section className="pu-card">
//               <div className="pu-state">
//                 <div className="pu-state-icon">✓</div>
//                 <h2>Payment receipt</h2>
//                 <p>Receipt preview based on the latest available payment record.</p>
//               </div>
//               {loading ? <div className="pu-empty">Loading payment record…</div> :
//                 latestPayment ? (
//                   <div className="pu-details">
//                     <div className="pu-detail"><span>Payment ID</span><strong>{latestPayment._id || "—"}</strong></div>
//                     <div className="pu-detail"><span>Amount</span><strong>₹{amount.toLocaleString("en-IN")}</strong></div>
//                     <div className="pu-detail"><span>Status</span><strong>{latestPayment.status || "Unknown"}</strong></div>
//                     <div className="pu-detail"><span>Date</span><strong>{formatDate(latestPayment.capturedAt || latestPayment.createdAt)}</strong></div>
//                     <div className="pu-detail"><span>Booking ID</span><strong>{String(bookingReference)}</strong></div>
//                   </div>
//                 ) : <div className="pu-empty">No payment record is available to show a receipt.</div>
//               }
//               <div className={`pu-alert ${statusClass(latestPayment?.status)}`} style={{ marginTop: 18 }}>
//                 A receipt is not proof of successful payment unless the payment status is confirmed by the payment provider.
//               </div>
//             </section>
//           )}

//           {section === "failed" && (
//             <section className="pu-card pu-state">
//               <div className="pu-state-icon">!</div>
//               <h2>Payment not confirmed</h2>
//               <p>This preview does not claim that a real payment failed. Check your payment history for the actual status.</p>
//               <div className="pu-alert red">Latest available status: {latestPayment?.status || "No payment record loaded"}</div>
//               <button className="pu-btn" onClick={fetchPayments} disabled={loading}>
//                 Refresh payment records
//               </button>
//               <button className="pu-btn" onClick={() => setSection("checkout")}>Back to checkout preview</button>
//             </section>
//           )}

//           {section === "refund" && (
//             <section className="pu-card">
//               <h2>Refund status</h2>
//               {loading ? <div className="pu-empty">Loading payment records…</div> :
//                 payments.length === 0 ? (
//                   <div className="pu-empty">No payment records are available to check for refunds.</div>
//                 ) : (
//                   <div className="pu-table-wrap">
//                     <table className="pu-table">
//                       <thead>
//                         <tr><th>Payment ID</th><th>Date</th><th>Amount</th><th>Payment status</th></tr>
//                       </thead>
//                       <tbody>
//                         {payments.map((payment) => {
//                           const value = payment.amountPaise != null
//                             ? Number(payment.amountPaise) / 100 : Number(payment.amount || 0);
//                           return (
//                             <tr key={payment._id}>
//                               <td>{payment._id || "—"}</td>
//                               <td>{formatDate(payment.createdAt)}</td>
//                               <td>₹{value.toLocaleString("en-IN")}</td>
//                               <td>{payment.status || "Unknown"}</td>
//                             </tr>
//                           );
//                         })}
//                       </tbody>
//                     </table>
//                   </div>
//                 )}
//               <p className="pu-note">Refund information is only shown when the API provides payment records. This page does not request or process a refund.</p>
//             </section>
//           )}

//           <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
//             <button className="pu-btn" onClick={() => navigate("/dashboard")}>← Student dashboard</button>
//             <button className="pu-btn" onClick={() => navigate("/my-payments")}>Payment history</button>
//             <button className="pu-btn" onClick={handleLogout}>Logout ↗</button>
//             <button className="pu-btn" onClick={fetchPayments} disabled={loading}>
//               {loading ? "Refreshing…" : "↻ Refresh records"}
//             </button>
//           </div>
//         </main>
//       </div>

//       <footer className="pu-footer">
//         <strong>THRONE8</strong>
//         <div>Empowering your journey through mentorship.</div>
//         © {new Date().getFullYear()} THRONE8 Mentorship. All rights reserved.
//       </footer>
//     </div>
//   );
// }































// import { useCallback, useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// function formatDate(date) {
//   if (!date) return "Not available";

//   return new Date(date).toLocaleString("en-IN", {
//     dateStyle: "medium",
//     timeStyle: "short",
//   });
// }

// function MyPayments() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [payments, setPayments] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   const fetchPayments = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const response = await api.get("/payments/my");
//       setPayments(response.data.payments || []);
//     } catch (err) {
//       setError(
//         err.response?.data?.message ||
//           "Unable to load your payment history."
//       );
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchPayments();
//   }, [fetchPayments]);

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
//           <Link to="/my-bookings">My Bookings</Link>
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
//           <h1>Payment History</h1>
//           <p>
//             Welcome{user?.name ? `, ${user.name}` : ""}.
//             View your mentorship payment records.
//           </p>
//           <button
//             className="btn btn-outline"
//             onClick={fetchPayments}
//             disabled={loading}
//           >
//             {loading ? "Refreshing..." : "Refresh Payments"}
//           </button>
//         </section>

//         {loading ? (
//           <p>Loading your payments...</p>
//         ) : error ? (
//           <section className="dashboard-card">
//             <p>{error}</p>
//             <button
//               className="btn btn-primary"
//               onClick={fetchPayments}
//             >
//               Try Again
//             </button>
//           </section>
//         ) : payments.length === 0 ? (
//           <section className="dashboard-card">
//             <h2>No payment records yet</h2>
//             <p>Your completed and pending payment records will appear here.</p>
//           </section>
//         ) : (
//           <>
//             <p>
//               Total payment records:{" "}
//               <strong>{payments.length}</strong>
//             </p>

//             <section className="dashboard-grid">
//               {payments.map((payment) => (
//                 <article
//                   className="dashboard-card"
//                   key={payment._id}
//                 >
//                   <p className="eyebrow">PAYMENT RECORD</p>

//                   <h2>
//                     ₹{(payment.amountPaise || 0) / 100}
//                   </h2>

//                   <p>
//                     <strong>Status:</strong>{" "}
//                     <span className={`status status-${payment.status.toLowerCase()}`}>
//                       {payment.status}
//                     </span>
//                   </p>

//                   <p>
//                     <strong>Currency:</strong>{" "}
//                     {payment.currency || "INR"}
//                   </p>

//                   <p>
//                     <strong>Payment date:</strong>{" "}
//                     {formatDate(payment.capturedAt || payment.createdAt)}
//                   </p>

//                   <p className="profile-detail">
//                     <strong>Booking ID:</strong>{" "}
//                     {payment.bookingId?._id || payment.bookingId || "N/A"}
//                   </p>
//                 </article>
//               ))}
//             </section>
//           </>
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

// export default MyPayments;
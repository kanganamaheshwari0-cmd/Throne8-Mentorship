
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

const styles = `
.student-pro{min-height:100vh;background:#080c1b;color:#eef1ff;font-family:Inter,system-ui,sans-serif;font-size:14px}
.student-pro *{box-sizing:border-box}.student-pro button,.student-pro a{font:inherit}.student-pro a{text-decoration:none}
.sp-topbar{height:72px;position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 28px;background:rgba(10,15,35,.97);border-bottom:1px solid #20294b}
.sp-brand{display:flex;align-items:center;gap:12px;color:#f5f6ff;font-size:23px;font-weight:850;letter-spacing:-.8px}
.sp-brand-mark,.sp-avatar{display:grid;place-items:center;flex-shrink:0;color:white;background:linear-gradient(135deg,#9b72ff,#6046ed);font-weight:800}
.sp-brand-mark{width:39px;height:39px;border-radius:12px;font-size:16px;box-shadow:0 5px 20px #6949ed40}
.sp-brand small{font-size:11px;color:#a9a1ff;font-weight:600;letter-spacing:0;padding:7px 11px;border:1px solid #39336f;border-radius:20px;margin-left:5px}
.sp-top-actions{display:flex;align-items:center;gap:17px}.sp-top-link{color:#bdc7e8;border:1px solid #2b355b;border-radius:10px;padding:9px 13px;background:#111832;cursor:pointer}
.sp-top-link:hover{border-color:#8970ff;color:white}.sp-user-chip{display:flex;align-items:center;gap:10px;color:#e5e8ff;min-width:0}
.sp-avatar{width:39px;height:39px;border-radius:50%;font-size:16px}
.sp-layout{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:calc(100vh - 72px)}
.sp-sidebar{padding:24px 14px;background:#0b1023;border-right:1px solid #20294b;display:flex;flex-direction:column;gap:6px}
.sp-side-label{color:#6f7ba6;font-size:10px;font-weight:800;letter-spacing:1.8px;padding:12px 13px 9px}
.sp-nav-item{display:flex;align-items:center;gap:13px;padding:13px;border-radius:11px;color:#aab6db;border:1px solid transparent;transition:.2s}
.sp-nav-item:hover{color:white;background:#151d3b;border-color:#252f58}.sp-nav-item.active{color:white;background:linear-gradient(100deg,#342878,#201c50);border-color:#423487;box-shadow:inset 3px 0 #a48bff}
.sp-nav-icon{width:23px;text-align:center;font-size:18px}
.sp-sidebar-bottom{margin-top:auto;padding:18px;border:1px solid #303065;border-radius:15px;background:radial-gradient(circle at 100% 0,#5140a344,transparent 55%),#121832}
.sp-sidebar-bottom strong{display:block;font-size:14px;margin-bottom:9px}.sp-sidebar-bottom p{color:#9da9d0;font-size:12px;line-height:1.7;margin:0}.sp-sidebar-bottom span{display:block;color:#b9a7ff;font-size:24px;margin-bottom:12px}
.sp-content{min-width:0;width:100%;max-width:1600px;margin:0 auto;padding:30px}
.sp-welcome-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,370px);align-items:center;gap:22px;margin-bottom:27px}
.sp-eyebrow{margin:0 0 10px;color:#a99aff;font-size:10px;font-weight:800;letter-spacing:2px}
.sp-welcome h1{font-size:clamp(25px,3vw,34px);line-height:1.25;letter-spacing:-1px;margin:0 0 10px}.sp-welcome h1 span{color:#a996ff}
.sp-welcome>p:last-child{margin:0;color:#9eacd2;line-height:1.8;max-width:600px}
.sp-profile-mini{display:flex;align-items:center;gap:13px;min-width:0;padding:17px;border:1px solid #28325a;border-radius:15px;background:linear-gradient(120deg,#111a37,#10152c)}
.sp-profile-mini-info{min-width:0;flex:1}.sp-profile-mini-info strong{display:block;color:#f4f5ff;font-size:14px;overflow-wrap:anywhere;margin-bottom:5px}
.sp-profile-mini-info span{display:block;color:#9ba8d1;font-size:12px;overflow-wrap:anywhere}
.sp-role{display:inline-block!important;width:fit-content;margin-top:8px;padding:4px 9px;color:#c8baff!important;background:#38277c;border-radius:20px;font-size:10px!important}
.sp-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:27px 0 16px}
.sp-section-head h2{margin:0;font-size:19px;letter-spacing:-.4px}.sp-section-head p{margin:6px 0 0;color:#8492bb;font-size:12px;line-height:1.6}
.sp-muted-link{color:#a99aff;font-size:12px;white-space:nowrap}
.sp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}
.sp-stat{min-width:0;padding:20px;border:1px solid #263158;border-left:3px solid #8c65ff;border-radius:13px;background:linear-gradient(145deg,#121a35,#10152b)}
.sp-stat:nth-child(2){border-left-color:#5595ff}.sp-stat:nth-child(3){border-left-color:#31d4a1}.sp-stat:nth-child(4){border-left-color:#bf7bff}
.sp-stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:18px}
.sp-stat-label{color:#aab6db;font-size:12px;line-height:1.6}.sp-stat-icon{display:grid;place-items:center;width:37px;height:37px;flex-shrink:0;border-radius:11px;background:#302565;color:#c3b4ff;font-size:17px}
.sp-stat:nth-child(2) .sp-stat-icon{background:#172e62;color:#85b5ff}.sp-stat:nth-child(3) .sp-stat-icon{background:#10493f;color:#5af0c3}.sp-stat:nth-child(4) .sp-stat-icon{background:#382153;color:#e1a9ff}
.sp-stat-value{display:block;font-size:27px;font-weight:800;color:#f6f7ff;overflow-wrap:anywhere}
.sp-stat-note{color:#8292bc;font-size:11px;line-height:1.7;margin:8px 0 0}
.sp-main-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(270px,.75fr);gap:18px;margin-top:21px}
.sp-panel{min-width:0;border:1px solid #263158;border-radius:15px;background:#0e152c;overflow:hidden}
.sp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 21px;border-bottom:1px solid #202a4b}
.sp-panel-head h2{margin:0;font-size:16px}.sp-panel-head p{margin:6px 0 0;color:#8594bd;font-size:12px}.sp-panel-body{padding:18px 20px}
.sp-action-list{display:grid;gap:10px}.sp-action{display:flex;align-items:center;gap:13px;padding:14px;min-width:0;color:#eef1ff;border:1px solid #28335c;border-radius:12px;background:#121b37;transition:.2s}
.sp-action:hover{border-color:#7964e8;background:#191f43;transform:translateY(-1px)}
.sp-action-icon{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:12px;color:#d2c8ff;background:linear-gradient(135deg,#6347cf,#3d307f);font-size:19px}
.sp-action-info{flex:1;min-width:0}.sp-action-info strong{display:block;font-size:13px;margin-bottom:5px}.sp-action-info span{display:block;color:#94a2cb;font-size:11px;line-height:1.6}
.sp-action-arrow{color:#a99aff;font-size:20px}
.sp-tip{padding:18px;margin-top:15px;border:1px solid #3a3270;border-radius:12px;background:linear-gradient(120deg,#211c4b,#141b38)}
.sp-tip strong{display:block;font-size:13px;margin-bottom:7px}.sp-tip p{margin:0;color:#a9b2d5;font-size:12px;line-height:1.8}
.sp-table-wrap{width:100%;overflow-x:auto}.sp-table{width:100%;border-collapse:collapse;text-align:left;white-space:nowrap}
.sp-table th{padding:13px 15px;color:#8e9dc6;background:#131c39;font-size:11px;font-weight:600}
.sp-table td{padding:15px;color:#dce3ff;border-bottom:1px solid #202a4b;font-size:12px}.sp-table tr:last-child td{border-bottom:0}
.sp-status{display:inline-block;padding:5px 9px;border-radius:20px;background:#192b4c;color:#93bdff;font-size:10px;font-weight:800}
.sp-status.success{background:#103a35;color:#5ce7bd}.sp-status.warning{background:#47351b;color:#ffd27d}.sp-status.danger{background:#482238;color:#ff9bb9}
.sp-empty{text-align:center;padding:27px 15px;color:#94a2ca;line-height:1.8;font-size:12px}.sp-empty-icon{display:block;font-size:28px;margin-bottom:10px}
.sp-empty strong{display:block;color:#edf0ff;font-size:14px;margin-bottom:5px}.sp-empty a{display:inline-block;margin-top:12px;padding:9px 13px;border-radius:9px;background:#6e53df;color:white}
.sp-error{margin-bottom:15px;padding:13px 15px;color:#ffb7c8;background:#381c31;border:1px solid #66324d;border-radius:10px;line-height:1.7}
.sp-bottom-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:20px}
.sp-profile-content{padding:20px}.sp-profile-row{display:flex;justify-content:space-between;gap:15px;padding:13px 0;border-bottom:1px solid #202a4b}
.sp-profile-row:last-child{border-bottom:0}.sp-profile-row span{color:#8795bc;font-size:12px}
.sp-profile-row strong{max-width:65%;color:#edf0ff;font-size:12px;text-align:right;overflow-wrap:anywhere}
.sp-footer{padding:22px 10px 5px;color:#66769f;text-align:center;font-size:11px;line-height:1.8}.sp-footer strong{color:#a79aff}
@media(max-width:1200px){.sp-content{padding:24px 20px}.sp-layout{grid-template-columns:205px minmax(0,1fr)}.sp-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-welcome-row{grid-template-columns:1fr}.sp-profile-mini{max-width:440px}}
@media(max-width:850px){.sp-layout{grid-template-columns:1fr}.sp-sidebar{flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid #20294b;padding:12px;gap:7px}.sp-side-label,.sp-sidebar-bottom{display:none}.sp-nav-item{flex:1 1 135px;padding:11px}.sp-main-grid,.sp-bottom-grid{grid-template-columns:1fr}}
@media(max-width:540px){.sp-topbar{height:auto;min-height:66px;padding:12px 15px}.sp-brand{font-size:19px;gap:8px}.sp-brand-mark{width:34px;height:34px}.sp-brand small{display:none}.sp-top-actions{gap:8px}.sp-top-link{padding:8px 9px;font-size:12px!important}.sp-user-chip>span:last-child{display:none}.sp-content{padding:21px 13px}.sp-stats{gap:10px}.sp-stat{padding:15px}.sp-stat-value{font-size:22px}.sp-panel-head{padding:16px}.sp-panel-body{padding:13px}.sp-welcome h1{font-size:27px}.sp-profile-mini{padding:13px}}
`;

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.bookings)) return data.data.bookings;
  if (Array.isArray(data?.data?.payments)) return data.data.payments;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getStatus(item) {
  return String(
    item?.status ||
    item?.bookingStatus ||
    item?.paymentStatus ||
    item?.payment?.status ||
    "pending"
  ).toLowerCase();
}

function getMentorName(item) {
  const mentor = item?.mentor || item?.mentorId || item?.tutor;
  if (typeof mentor === "string") return "Mentor";
  return (
    mentor?.name ||
    mentor?.fullName ||
    mentor?.user?.name ||
    item?.mentorName ||
    "Mentor"
  );
}

function getDate(item) {
  const value =
    item?.slotDate ||
    item?.sessionDate ||
    item?.date ||
    item?.createdAt ||
    item?.bookingDate;

  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// amountPaise is always converted from paise to rupees.
// amount is displayed as rupees, matching the My Payments page.
function getAmountNumber(item) {
  const amountPaise = item?.amountPaise ?? item?.payment?.amountPaise;

  if (amountPaise !== undefined && amountPaise !== null && amountPaise !== "") {
    const value = Number(amountPaise);
    return Number.isFinite(value) ? value / 100 : null;
  }

  const value =
    item?.amount ??
    item?.payment?.amount ??
    item?.price ??
    item?.totalAmount ??
    item?.booking?.price;

  if (value === undefined || value === null || value === "") return null;

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function getAmount(item) {
  const amount = getAmountNumber(item);
  if (amount === null) return null;

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusClass(status) {
  if (/complete|success|paid|captured|approved/.test(status)) return "success";
  if (/cancel|fail|reject|expire|refund/.test(status)) return "danger";
  if (/pending|upcoming|confirm|process|created|authorized/.test(status)) return "warning";
  return "";
}

function prettyStatus(status) {
  return status.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const name = user?.name || user?.fullName || "Student";
  const firstName = name.trim().split(" ")[0] || "Student";
  const initial = name.trim().charAt(0).toUpperCase() || "S";

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    setBookingError("");

    try {
      const response = await api.get("/bookings/my");
      setBookings(getList(response.data));
    } catch (error) {
      console.error("Unable to load student bookings:", error);
      setBookingError("Bookings could not be loaded right now.");
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true);
    setPaymentError("");

    try {
      const response = await api.get("/payments/my");
      setPayments(getList(response.data));
    } catch (error) {
      console.error("Unable to load student payments:", error);
      setPaymentError("Payment history could not be loaded right now.");
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    loadPayments();
  }, [loadBookings, loadPayments]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  };

  const completedBookings = bookings.filter((booking) =>
    /complete|finished|success/.test(getStatus(booking))
  );

  const upcomingBookings = bookings.filter((booking) =>
    /upcoming|confirmed|scheduled/.test(getStatus(booking))
  );

  const totalSpent = payments.reduce((total, payment) => {
    if (getStatus(payment) !== "captured") return total;

    const amount = getAmountNumber(payment);
    return amount === null ? total : total + amount;
  }, 0);

  const currency = (amount) =>
    `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const recentBookings = [...bookings]
    .sort((a, b) => {
      const da = new Date(
        a?.slotDate || a?.sessionDate || a?.date || a?.createdAt || 0
      ).getTime();
      const db = new Date(
        b?.slotDate || b?.sessionDate || b?.date || b?.createdAt || 0
      ).getTime();
      return db - da;
    })
    .slice(0, 5);

  const recentPayments = [...payments]
    .sort((a, b) => {
      const da = new Date(a?.createdAt || a?.capturedAt || a?.updatedAt || 0).getTime();
      const db = new Date(b?.createdAt || b?.capturedAt || b?.updatedAt || 0).getTime();
      return db - da;
    })
    .slice(0, 5);

  return (
    <div className="student-pro">
      <style>{styles}</style>

      <header className="sp-topbar">
        <Link to="/" className="sp-brand">
          <span className="sp-brand-mark">T8</span>
          <span>Throne8</span>
          <small>Student Portal</small>
        </Link>

        <div className="sp-top-actions">
          <button type="button" className="sp-top-link" onClick={() => navigate("/")}>
            ← Home
          </button>
          <div className="sp-user-chip">
            <span className="sp-avatar">{initial}</span>
            <span>{firstName}</span>
          </div>
        </div>
      </header>

      <div className="sp-layout">
        <aside className="sp-sidebar">
          <div className="sp-side-label">WORKSPACE</div>

          <Link className="sp-nav-item active" to="/dashboard">
            <span className="sp-nav-icon">⌂</span>Dashboard
          </Link>
          <Link className="sp-nav-item" to="/mentors">
            <span className="sp-nav-icon">⌕</span>Find Mentors
          </Link>
          <Link className="sp-nav-item" to="/my-bookings">
            <span className="sp-nav-icon">▦</span>My Bookings
          </Link>
          <Link className="sp-nav-item" to="/my-payments">
            <span className="sp-nav-icon">₹</span>My Payments
          </Link>
          <a className="sp-nav-item" href="#student-profile">
            <span className="sp-nav-icon">◎</span>My Profile
          </a>

          <div className="sp-side-label">ACCOUNT</div>
          <button
            type="button"
            className="sp-nav-item"
            onClick={handleLogout}
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <span className="sp-nav-icon">↪</span>Logout
          </button>

          <div className="sp-sidebar-bottom">
            <span>✦</span>
            <strong>Better Mentorship, Bigger Opportunities</strong>
            <p>Learn. Grow. Succeed. Your journey starts with the right guidance.</p>
          </div>
        </aside>

        <main className="sp-content">
          {(bookingError || paymentError) && (
            <div className="sp-error">
              {bookingError && <div>{bookingError}</div>}
              {paymentError && <div>{paymentError}</div>}
              <button
                type="button"
                className="sp-top-link"
                style={{ marginTop: 10 }}
                onClick={() => {
                  loadBookings();
                  loadPayments();
                }}
              >
                Try again
              </button>
            </div>
          )}

          <section className="sp-welcome-row">
            <div className="sp-welcome">
              <p className="sp-eyebrow">STUDENT DASHBOARD</p>
              <h1>
                Welcome back, <span>{firstName}!</span> 👋
              </h1>
              <p>
                Your mentorship journey starts with the right guidance.
                Discover mentors, manage your sessions, and keep moving
                toward your goals.
              </p>
            </div>

            <div className="sp-profile-mini">
              <span className="sp-avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                {initial}
              </span>
              <div className="sp-profile-mini-info">
                <strong>{name}</strong>
                <span>{user?.email || "THRONE8 Student Account"}</span>
                <span className="sp-role">Student</span>
              </div>
            </div>
          </section>

          <div className="sp-section-head">
            <div>
              <h2>Your Overview</h2>
              <p>Your mentorship activity at a glance.</p>
            </div>
            <button
              type="button"
              className="sp-top-link"
              onClick={() => {
                loadBookings();
                loadPayments();
              }}
            >
              ↻ Refresh
            </button>
          </div>

          <section className="sp-stats">
            <article className="sp-stat">
              <div className="sp-stat-top">
                <span className="sp-stat-label">Total Bookings</span>
                <span className="sp-stat-icon">▦</span>
              </div>
              <strong className="sp-stat-value">
                {loadingBookings ? "…" : bookings.length}
              </strong>
              <p className="sp-stat-note">All your mentorship bookings</p>
            </article>

            <article className="sp-stat">
              <div className="sp-stat-top">
                <span className="sp-stat-label">Upcoming Sessions</span>
                <span className="sp-stat-icon">◷</span>
              </div>
              <strong className="sp-stat-value">
                {loadingBookings ? "…" : upcomingBookings.length}
              </strong>
              <p className="sp-stat-note">Scheduled or confirmed sessions</p>
            </article>

            <article className="sp-stat">
              <div className="sp-stat-top">
                <span className="sp-stat-label">Completed Sessions</span>
                <span className="sp-stat-icon">✓</span>
              </div>
              <strong className="sp-stat-value">
                {loadingBookings ? "…" : completedBookings.length}
              </strong>
              <p className="sp-stat-note">Sessions marked completed</p>
            </article>

            <article className="sp-stat">
              <div className="sp-stat-top">
                <span className="sp-stat-label">Total Spent</span>
                <span className="sp-stat-icon">₹</span>
              </div>
              <strong className="sp-stat-value">
                {loadingPayments ? "…" : currency(totalSpent)}
              </strong>
              <p className="sp-stat-note">Sum of captured payment records</p>
            </article>
          </section>

          <section className="sp-main-grid">
            <div className="sp-panel">
              <div className="sp-panel-head">
                <div>
                  <h2>Recent Bookings</h2>
                  <p>Your latest mentorship activity</p>
                </div>
                <Link to="/my-bookings" className="sp-muted-link">View all →</Link>
              </div>

              {loadingBookings ? (
                <div className="sp-empty">Loading your bookings…</div>
              ) : bookingError ? (
                <div className="sp-empty">Booking data is unavailable.</div>
              ) : recentBookings.length === 0 ? (
                <div className="sp-empty">
                  <span className="sp-empty-icon">✦</span>
                  <strong>Your journey starts here</strong>
                  You haven't got any bookings to show yet.
                  <div><Link to="/mentors">Find a Mentor →</Link></div>
                </div>
              ) : (
                <div className="sp-table-wrap">
                  <table className="sp-table">
                    <thead>
                      <tr><th>MENTOR</th><th>SESSION DATE</th><th>STATUS</th></tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((booking, index) => {
                        const status = getStatus(booking);
                        return (
                          <tr key={booking?._id || booking?.id || index}>
                            <td>{getMentorName(booking)}</td>
                            <td>{getDate(booking)}</td>
                            <td>
                              <span className={`sp-status ${statusClass(status)}`}>
                                {prettyStatus(status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Make the most of your account</p>
                </div>
              </div>
              <div className="sp-panel-body">
                <div className="sp-action-list">
                  <Link to="/mentors" className="sp-action">
                    <span className="sp-action-icon">⌕</span>
                    <span className="sp-action-info">
                      <strong>Find Mentors</strong>
                      <span>Discover the right guide for your goals</span>
                    </span>
                    <span className="sp-action-arrow">›</span>
                  </Link>
                  <Link to="/my-bookings" className="sp-action">
                    <span className="sp-action-icon">▦</span>
                    <span className="sp-action-info">
                      <strong>Manage Bookings</strong>
                      <span>Review your mentorship sessions</span>
                    </span>
                    <span className="sp-action-arrow">›</span>
                  </Link>
                  <Link to="/my-payments" className="sp-action">
                    <span className="sp-action-icon">₹</span>
                    <span className="sp-action-info">
                      <strong>Payment History</strong>
                      <span>Check your available transactions</span>
                    </span>
                    <span className="sp-action-arrow">›</span>
                  </Link>
                  <a href="#student-profile" className="sp-action">
                    <span className="sp-action-icon">◎</span>
                    <span className="sp-action-info">
                      <strong>My Profile</strong>
                      <span>Review your account information</span>
                    </span>
                    <span className="sp-action-arrow">›</span>
                  </a>
                </div>
                <div className="sp-tip">
                  <strong>✦ Make your next move</strong>
                  <p>
                    Book a session with a mentor who understands your goals
                    and take the next step in your professional journey.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="sp-bottom-grid">
            <div className="sp-panel">
              <div className="sp-panel-head">
                <div>
                  <h2>Recent Payments</h2>
                  <p>Your latest payment records</p>
                </div>
                <Link to="/my-payments" className="sp-muted-link">View all →</Link>
              </div>

              {loadingPayments ? (
                <div className="sp-empty">Loading payment records…</div>
              ) : paymentError ? (
                <div className="sp-empty">Payment data is unavailable.</div>
              ) : recentPayments.length === 0 ? (
                <div className="sp-empty">
                  <span className="sp-empty-icon">₹</span>
                  <strong>No payment records yet</strong>
                  Your payment activity will appear here when available.
                </div>
              ) : (
                <div className="sp-table-wrap">
                  <table className="sp-table">
                    <thead>
                      <tr><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr>
                    </thead>
                    <tbody>
                      {recentPayments.map((payment, index) => {
                        const status = getStatus(payment);
                        const amount = getAmount(payment);

                        return (
                          <tr key={payment?._id || payment?.id || index}>
                            <td>{getDate(payment)}</td>
                            <td>{amount === null ? "—" : `₹${amount}`}</td>
                            <td>
                              <span className={`sp-status ${statusClass(status)}`}>
                                {prettyStatus(status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="sp-panel" id="student-profile">
              <div className="sp-panel-head">
                <div>
                  <h2>My Profile</h2>
                  <p>Your account information</p>
                </div>
              </div>
              <div className="sp-profile-content">
                <div className="sp-profile-row">
                  <span>Full Name</span><strong>{name}</strong>
                </div>
                <div className="sp-profile-row">
                  <span>Email Address</span>
                  <strong>{user?.email || "Not available"}</strong>
                </div>
                <div className="sp-profile-row">
                  <span>Account Type</span><strong>Student</strong>
                </div>
                <div className="sp-profile-row">
                  <span>Platform</span><strong>THRONE8 Mentorship</strong>
                </div>
              </div>
            </div>
          </section>

          <footer className="sp-footer">
            <strong>THRONE8</strong> · Empowering your journey through mentorship.
            <br />
            © {new Date().getFullYear()} THRONE8 Mentorship. All rights reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;































// import { useEffect, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// const styles = `
//   .student-pro {
//     min-height: 100vh;
//     background: #080c1b;
//     color: #eef1ff;
//     font-family: Inter, system-ui, -apple-system, sans-serif;
//     font-size: 14px;
//   }

//   .student-pro * { box-sizing: border-box; }

//   .student-pro button,
//   .student-pro a { font: inherit; }

//   .student-pro a { text-decoration: none; }

//   .sp-topbar {
//     height: 72px;
//     position: sticky;
//     top: 0;
//     z-index: 20;
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 18px;
//     padding: 0 28px;
//     background: rgba(10, 15, 35, .97);
//     border-bottom: 1px solid #20294b;
//   }

//   .sp-brand {
//     display: flex;
//     align-items: center;
//     gap: 12px;
//     color: #f5f6ff;
//     font-size: 23px;
//     font-weight: 850;
//     letter-spacing: -.8px;
//   }

//   .sp-brand-mark {
//     width: 39px;
//     height: 39px;
//     display: grid;
//     place-items: center;
//     border-radius: 12px;
//     color: white;
//     background: linear-gradient(135deg, #9b72ff, #6046ed);
//     box-shadow: 0 5px 20px #6949ed40;
//     font-size: 16px;
//   }

//   .sp-brand small {
//     font-size: 11px;
//     color: #a9a1ff;
//     font-weight: 600;
//     letter-spacing: 0;
//     padding: 7px 11px;
//     border: 1px solid #39336f;
//     border-radius: 20px;
//     margin-left: 5px;
//   }

//   .sp-top-actions {
//     display: flex;
//     align-items: center;
//     gap: 17px;
//   }

//   .sp-top-link {
//     color: #bdc7e8;
//     border: 1px solid #2b355b;
//     border-radius: 10px;
//     padding: 9px 13px;
//     background: #111832;
//     cursor: pointer;
//   }

//   .sp-top-link:hover { border-color: #8970ff; color: white; }

//   .sp-user-chip {
//     display: flex;
//     align-items: center;
//     gap: 10px;
//     color: #e5e8ff;
//     min-width: 0;
//   }

//   .sp-avatar {
//     display: grid;
//     place-items: center;
//     flex-shrink: 0;
//     width: 39px;
//     height: 39px;
//     border-radius: 50%;
//     color: white;
//     background: linear-gradient(135deg, #a184ff, #6345e8);
//     font-weight: 800;
//     font-size: 16px;
//   }

//   .sp-layout {
//     display: grid;
//     grid-template-columns: 245px minmax(0, 1fr);
//     min-height: calc(100vh - 72px);
//   }

//   .sp-sidebar {
//     padding: 24px 14px;
//     background: #0b1023;
//     border-right: 1px solid #20294b;
//     display: flex;
//     flex-direction: column;
//     gap: 6px;
//   }

//   .sp-side-label {
//     color: #6f7ba6;
//     font-size: 10px;
//     font-weight: 800;
//     letter-spacing: 1.8px;
//     padding: 12px 13px 9px;
//   }

//   .sp-nav-item {
//     display: flex;
//     align-items: center;
//     gap: 13px;
//     padding: 13px;
//     border-radius: 11px;
//     color: #aab6db;
//     border: 1px solid transparent;
//     transition: .2s;
//   }

//   .sp-nav-item:hover {
//     color: white;
//     background: #151d3b;
//     border-color: #252f58;
//   }

//   .sp-nav-item.active {
//     color: #fff;
//     background: linear-gradient(100deg, #342878, #201c50);
//     border-color: #423487;
//     box-shadow: inset 3px 0 #a48bff;
//   }

//   .sp-nav-icon {
//     width: 23px;
//     text-align: center;
//     font-size: 18px;
//   }

//   .sp-sidebar-bottom {
//     margin-top: auto;
//     padding: 18px;
//     border: 1px solid #303065;
//     border-radius: 15px;
//     background:
//       radial-gradient(circle at 100% 0, #5140a344, transparent 55%),
//       #121832;
//   }

//   .sp-sidebar-bottom strong {
//     display: block;
//     font-size: 14px;
//     margin-bottom: 9px;
//   }

//   .sp-sidebar-bottom p {
//     color: #9da9d0;
//     font-size: 12px;
//     line-height: 1.7;
//     margin: 0;
//   }

//   .sp-sidebar-bottom span {
//     display: block;
//     color: #b9a7ff;
//     font-size: 24px;
//     margin-bottom: 12px;
//   }

//   .sp-content {
//     min-width: 0;
//     width: 100%;
//     max-width: 1600px;
//     margin: 0 auto;
//     padding: 30px;
//   }

//   .sp-welcome-row {
//     display: grid;
//     grid-template-columns: minmax(0, 1fr) minmax(260px, 370px);
//     align-items: center;
//     gap: 22px;
//     margin-bottom: 27px;
//   }

//   .sp-eyebrow {
//     margin: 0 0 10px;
//     color: #a99aff;
//     font-size: 10px;
//     font-weight: 800;
//     letter-spacing: 2px;
//   }

//   .sp-welcome h1 {
//     font-size: clamp(25px, 3vw, 34px);
//     line-height: 1.25;
//     letter-spacing: -1px;
//     margin: 0 0 10px;
//   }

//   .sp-welcome h1 span { color: #a996ff; }

//   .sp-welcome > p:last-child {
//     margin: 0;
//     color: #9eacd2;
//     line-height: 1.8;
//     max-width: 600px;
//   }

//   .sp-profile-mini {
//     display: flex;
//     align-items: center;
//     gap: 13px;
//     min-width: 0;
//     padding: 17px;
//     border: 1px solid #28325a;
//     border-radius: 15px;
//     background: linear-gradient(120deg, #111a37, #10152c);
//   }

//   .sp-profile-mini-info { min-width: 0; flex: 1; }

//   .sp-profile-mini-info strong {
//     display: block;
//     color: #f4f5ff;
//     font-size: 14px;
//     overflow-wrap: anywhere;
//     margin-bottom: 5px;
//   }

//   .sp-profile-mini-info span {
//     display: block;
//     color: #9ba8d1;
//     font-size: 12px;
//     overflow-wrap: anywhere;
//   }

//   .sp-role {
//     display: inline-block !important;
//     width: fit-content;
//     margin-top: 8px;
//     padding: 4px 9px;
//     color: #c8baff !important;
//     background: #38277c;
//     border-radius: 20px;
//     font-size: 10px !important;
//   }

//   .sp-section-head {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 12px;
//     margin: 27px 0 16px;
//   }

//   .sp-section-head h2 {
//     margin: 0;
//     font-size: 19px;
//     letter-spacing: -.4px;
//   }

//   .sp-section-head p {
//     margin: 6px 0 0;
//     color: #8492bb;
//     font-size: 12px;
//     line-height: 1.6;
//   }

//   .sp-muted-link {
//     color: #a99aff;
//     font-size: 12px;
//     white-space: nowrap;
//   }

//   .sp-stats {
//     display: grid;
//     grid-template-columns: repeat(4, minmax(0, 1fr));
//     gap: 15px;
//   }

//   .sp-stat {
//     min-width: 0;
//     padding: 20px;
//     border: 1px solid #263158;
//     border-left: 3px solid #8c65ff;
//     border-radius: 13px;
//     background: linear-gradient(145deg, #121a35, #10152b);
//   }

//   .sp-stat:nth-child(2) { border-left-color: #5595ff; }
//   .sp-stat:nth-child(3) { border-left-color: #31d4a1; }
//   .sp-stat:nth-child(4) { border-left-color: #bf7bff; }

//   .sp-stat-top {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 8px;
//     margin-bottom: 18px;
//   }

//   .sp-stat-label {
//     color: #aab6db;
//     font-size: 12px;
//     line-height: 1.6;
//   }

//   .sp-stat-icon {
//     display: grid;
//     place-items: center;
//     width: 37px;
//     height: 37px;
//     flex-shrink: 0;
//     border-radius: 11px;
//     background: #302565;
//     color: #c3b4ff;
//     font-size: 17px;
//   }

//   .sp-stat:nth-child(2) .sp-stat-icon { background: #172e62; color: #85b5ff; }
//   .sp-stat:nth-child(3) .sp-stat-icon { background: #10493f; color: #5af0c3; }
//   .sp-stat:nth-child(4) .sp-stat-icon { background: #382153; color: #e1a9ff; }

//   .sp-stat-value {
//     display: block;
//     font-size: 27px;
//     font-weight: 800;
//     color: #f6f7ff;
//     overflow-wrap: anywhere;
//   }

//   .sp-stat-note {
//     color: #8292bc;
//     font-size: 11px;
//     line-height: 1.7;
//     margin: 8px 0 0;
//   }

//   .sp-main-grid {
//     display: grid;
//     grid-template-columns: minmax(0, 1.25fr) minmax(270px, .75fr);
//     gap: 18px;
//     margin-top: 21px;
//   }

//   .sp-panel {
//     min-width: 0;
//     border: 1px solid #263158;
//     border-radius: 15px;
//     background: #0e152c;
//     overflow: hidden;
//   }

//   .sp-panel-head {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 12px;
//     padding: 20px 21px;
//     border-bottom: 1px solid #202a4b;
//   }

//   .sp-panel-head h2 {
//     margin: 0;
//     font-size: 16px;
//   }

//   .sp-panel-head p {
//     margin: 6px 0 0;
//     color: #8594bd;
//     font-size: 12px;
//   }

//   .sp-panel-body { padding: 18px 20px; }

//   .sp-action-list {
//     display: grid;
//     gap: 10px;
//   }

//   .sp-action {
//     display: flex;
//     align-items: center;
//     gap: 13px;
//     padding: 14px;
//     min-width: 0;
//     color: #eef1ff;
//     border: 1px solid #28335c;
//     border-radius: 12px;
//     background: #121b37;
//     transition: .2s;
//   }

//   .sp-action:hover {
//     border-color: #7964e8;
//     background: #191f43;
//     transform: translateY(-1px);
//   }

//   .sp-action-icon {
//     display: grid;
//     place-items: center;
//     flex-shrink: 0;
//     width: 42px;
//     height: 42px;
//     border-radius: 12px;
//     color: #d2c8ff;
//     background: linear-gradient(135deg, #6347cf, #3d307f);
//     font-size: 19px;
//   }

//   .sp-action-info { flex: 1; min-width: 0; }

//   .sp-action-info strong {
//     display: block;
//     font-size: 13px;
//     margin-bottom: 5px;
//   }

//   .sp-action-info span {
//     display: block;
//     color: #94a2cb;
//     font-size: 11px;
//     line-height: 1.6;
//   }

//   .sp-action-arrow {
//     color: #a99aff;
//     font-size: 20px;
//   }

//   .sp-tip {
//     padding: 18px;
//     margin-top: 15px;
//     border: 1px solid #3a3270;
//     border-radius: 12px;
//     background: linear-gradient(120deg, #211c4b, #141b38);
//   }

//   .sp-tip strong {
//     display: block;
//     font-size: 13px;
//     margin-bottom: 7px;
//   }

//   .sp-tip p {
//     margin: 0;
//     color: #a9b2d5;
//     font-size: 12px;
//     line-height: 1.8;
//   }

//   .sp-table-wrap { width: 100%; overflow-x: auto; }

//   .sp-table {
//     width: 100%;
//     border-collapse: collapse;
//     text-align: left;
//     white-space: nowrap;
//   }

//   .sp-table th {
//     padding: 13px 15px;
//     color: #8e9dc6;
//     background: #131c39;
//     font-size: 11px;
//     font-weight: 600;
//   }

//   .sp-table td {
//     padding: 15px;
//     color: #dce3ff;
//     border-bottom: 1px solid #202a4b;
//     font-size: 12px;
//   }

//   .sp-table tr:last-child td { border-bottom: 0; }

//   .sp-status {
//     display: inline-block;
//     padding: 5px 9px;
//     border-radius: 20px;
//     background: #192b4c;
//     color: #93bdff;
//     font-size: 10px;
//     font-weight: 800;
//   }

//   .sp-status.success { background: #103a35; color: #5ce7bd; }
//   .sp-status.warning { background: #47351b; color: #ffd27d; }
//   .sp-status.danger { background: #482238; color: #ff9bb9; }

//   .sp-empty {
//     text-align: center;
//     padding: 27px 15px;
//     color: #94a2ca;
//     line-height: 1.8;
//     font-size: 12px;
//   }

//   .sp-empty-icon {
//     display: block;
//     font-size: 28px;
//     margin-bottom: 10px;
//   }

//   .sp-empty strong {
//     display: block;
//     color: #edf0ff;
//     font-size: 14px;
//     margin-bottom: 5px;
//   }

//   .sp-empty a {
//     display: inline-block;
//     margin-top: 12px;
//     padding: 9px 13px;
//     border-radius: 9px;
//     background: #6e53df;
//     color: white;
//   }

//   .sp-error {
//     margin-bottom: 15px;
//     padding: 13px 15px;
//     color: #ffb7c8;
//     background: #381c31;
//     border: 1px solid #66324d;
//     border-radius: 10px;
//     line-height: 1.7;
//   }

//   .sp-bottom-grid {
//     display: grid;
//     grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
//     gap: 18px;
//     margin-top: 20px;
//   }

//   .sp-profile-content { padding: 20px; }

//   .sp-profile-row {
//     display: flex;
//     justify-content: space-between;
//     gap: 15px;
//     padding: 13px 0;
//     border-bottom: 1px solid #202a4b;
//   }

//   .sp-profile-row:last-child { border-bottom: 0; }

//   .sp-profile-row span { color: #8795bc; font-size: 12px; }
//   .sp-profile-row strong {
//     max-width: 65%;
//     color: #edf0ff;
//     font-size: 12px;
//     text-align: right;
//     overflow-wrap: anywhere;
//   }

//   .sp-footer {
//     padding: 22px 10px 5px;
//     color: #66769f;
//     text-align: center;
//     font-size: 11px;
//     line-height: 1.8;
//   }

//   .sp-footer strong { color: #a79aff; }

//   @media (max-width: 1200px) {
//     .sp-content { padding: 24px 20px; }
//     .sp-layout { grid-template-columns: 205px minmax(0, 1fr); }
//     .sp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
//     .sp-welcome-row { grid-template-columns: 1fr; }
//     .sp-profile-mini { max-width: 440px; }
//   }

//   @media (max-width: 850px) {
//     .sp-layout { grid-template-columns: 1fr; }
//     .sp-sidebar {
//       flex-direction: row;
//       flex-wrap: wrap;
//       border-right: 0;
//       border-bottom: 1px solid #20294b;
//       padding: 12px;
//       gap: 7px;
//     }
//     .sp-side-label, .sp-sidebar-bottom { display: none; }
//     .sp-nav-item { flex: 1 1 135px; padding: 11px; }
//     .sp-main-grid, .sp-bottom-grid { grid-template-columns: 1fr; }
//   }

//   @media (max-width: 540px) {
//     .sp-topbar { height: auto; min-height: 66px; padding: 12px 15px; }
//     .sp-brand { font-size: 19px; gap: 8px; }
//     .sp-brand-mark { width: 34px; height: 34px; }
//     .sp-brand small { display: none; }
//     .sp-top-actions { gap: 8px; }
//     .sp-top-link { padding: 8px 9px; font-size: 12px !important; }
//     .sp-user-chip > span:last-child { display: none; }
//     .sp-content { padding: 21px 13px; }
//     .sp-stats { gap: 10px; }
//     .sp-stat { padding: 15px; }
//     .sp-stat-value { font-size: 22px; }
//     .sp-panel-head { padding: 16px; }
//     .sp-panel-body { padding: 13px; }
//     .sp-welcome h1 { font-size: 27px; }
//     .sp-profile-mini { padding: 13px; }
//   }
// `;

// function getList(data) {
//   if (Array.isArray(data)) return data;
//   if (Array.isArray(data?.bookings)) return data.bookings;
//   if (Array.isArray(data?.payments)) return data.payments;
//   if (Array.isArray(data?.data)) return data.data;
//   if (Array.isArray(data?.data?.bookings)) return data.data.bookings;
//   if (Array.isArray(data?.data?.payments)) return data.data.payments;
//   if (Array.isArray(data?.results)) return data.results;
//   return [];
// }

// function getStatus(item) {
//   return String(
//     item?.status ||
//     item?.bookingStatus ||
//     item?.paymentStatus ||
//     item?.payment?.status ||
//     "pending"
//   ).toLowerCase();
// }

// function getMentorName(item) {
//   const mentor = item?.mentor || item?.mentorId || item?.tutor;
//   if (typeof mentor === "string") return "Mentor";
//   return (
//     mentor?.name ||
//     mentor?.fullName ||
//     mentor?.user?.name ||
//     item?.mentorName ||
//     "Mentor"
//   );
// }

// function getDate(item) {
//   const value =
//     item?.slotDate ||
//     item?.sessionDate ||
//     item?.date ||
//     item?.createdAt ||
//     item?.bookingDate;

//   if (!value) return "—";
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return String(value);
//   return date.toLocaleDateString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// }

// function getAmount(item) {
//   const value =
//     item?.amount ??
//     item?.price ??
//     item?.totalAmount ??
//     item?.payment?.amount ??
//     item?.mentor?.price;

//   if (value === undefined || value === null || value === "") return null;
//   const amount = Number(value);
//   return Number.isFinite(amount)
//     ? amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })
//     : String(value);
// }

// function statusClass(status) {
//   if (/complete|success|paid|captured|approved/.test(status)) return "success";
//   if (/cancel|fail|reject|expire|refund/.test(status)) return "danger";
//   if (/pending|upcoming|confirm|process/.test(status)) return "warning";
//   return "";
// }

// function prettyStatus(status) {
//   return status.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) =>
//     letter.toUpperCase()
//   );
// }

// function StudentDashboard() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [bookings, setBookings] = useState([]);
//   const [payments, setPayments] = useState([]);
//   const [loadingBookings, setLoadingBookings] = useState(true);
//   const [loadingPayments, setLoadingPayments] = useState(true);
//   const [bookingError, setBookingError] = useState("");
//   const [paymentError, setPaymentError] = useState("");

//   const name = user?.name || user?.fullName || "Student";
//   const firstName = name.trim().split(" ")[0] || "Student";
//   const initial = name.trim().charAt(0).toUpperCase() || "S";


//   const loadBookings = async () => {
//     setLoadingBookings(true);
//     setBookingError("");

//     try {
//       const response = await api.get("/bookings/my");
//       setBookings(getList(response.data));
//     } catch (error) {
//       console.error("Unable to load student bookings:", error);
//       setBookingError("Bookings could not be loaded right now.");
//       setBookings([]);
//     } finally {
//       setLoadingBookings(false);
//     }
//   };

//   const loadPayments = async () => {
//     setLoadingPayments(true);
//     setPaymentError("");

//     try {
//       const response = await api.get("/payments/my");
//       setPayments(getList(response.data));
//     } catch (error) {
//       console.error("Unable to load student payments:", error);
//       setPaymentError("Payment history could not be loaded right now.");
//       setPayments([]);
//     } finally {
//       setLoadingPayments(false);
//     }
//   };


//   useEffect(() => {
//     loadBookings();
//     loadPayments();
//   }, []);

//   const handleLogout = async () => {
//     try {
//       await logout();
//     } finally {
//       navigate("/login");
//     }
//   };

//   const completedBookings = bookings.filter((booking) =>
//     /complete|finished|success/.test(getStatus(booking))
//   );

//   const upcomingBookings = bookings.filter((booking) =>
//     /upcoming|confirmed|scheduled/.test(getStatus(booking))
//   );

//   const totalSpent = payments.reduce((total, payment) => {
//     const status = getStatus(payment);
//     if (/fail|cancel|refund|pending/.test(status)) return total;

//     const amount = Number(
//       payment?.amount ??
//       payment?.price ??
//       payment?.totalAmount ??
//       payment?.payment?.amount ??
//       0
//     );

//     return total + (Number.isFinite(amount) ? amount : 0);
//   }, 0);

//   const currency = (amount) =>
//     `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

//   const recentBookings = [...bookings]
//     .sort((a, b) => {
//       const da = new Date(a?.slotDate || a?.sessionDate || a?.date || a?.createdAt || 0).getTime();
//       const db = new Date(b?.slotDate || b?.sessionDate || b?.date || b?.createdAt || 0).getTime();
//       return db - da;
//     })
//     .slice(0, 5);

//   const recentPayments = [...payments].slice(0, 5);

//   return (
//     <div className="student-pro">
//       <style>{styles}</style>

//       <header className="sp-topbar">
//         <Link to="/" className="sp-brand">
//           <span className="sp-brand-mark">T8</span>
//           <span>Throne8</span>
//           <small>Student Portal</small>
//         </Link>

//         <div className="sp-top-actions">
//           <button
//             type="button"
//             className="sp-top-link"
//             onClick={() => navigate("/")}
//           >
//             ← Home
//           </button>

//           <div className="sp-user-chip">
//             <span className="sp-avatar">{initial}</span>
//             <span>{firstName}</span>
//           </div>
//         </div>
//       </header>

//       <div className="sp-layout">
//         <aside className="sp-sidebar">
//           <div className="sp-side-label">WORKSPACE</div>

//           <Link className="sp-nav-item active" to="/dashboard">
//             <span className="sp-nav-icon">⌂</span>
//             Dashboard
//           </Link>

//           <Link className="sp-nav-item" to="/mentors">
//             <span className="sp-nav-icon">⌕</span>
//             Find Mentors
//           </Link>

//           <Link className="sp-nav-item" to="/my-bookings">
//             <span className="sp-nav-icon">▦</span>
//             My Bookings
//           </Link>

//           <Link className="sp-nav-item" to="/my-payments">
//             <span className="sp-nav-icon">₹</span>
//             My Payments
//           </Link>

//           <a
//             className="sp-nav-item"
//             href="#student-profile"
//           >
//             <span className="sp-nav-icon">◎</span>
//             My Profile
//           </a>

//           <div className="sp-side-label">ACCOUNT</div>

//           <button
//             type="button"
//             className="sp-nav-item"
//             onClick={handleLogout}
//             style={{
//               width: "100%",
//               textAlign: "left",
//               background: "transparent",
//               cursor: "pointer",
//             }}
//           >
//             <span className="sp-nav-icon">↪</span>
//             Logout
//           </button>

//           <div className="sp-sidebar-bottom">
//             <span>✦</span>
//             <strong>Better Mentorship, Bigger Opportunities</strong>
//             <p>Learn. Grow. Succeed. Your journey starts with the right guidance.</p>
//           </div>
//         </aside>

//         <main className="sp-content">
//           {(bookingError || paymentError) && (
//             <div className="sp-error">
//               {bookingError && <div>{bookingError}</div>}
//               {paymentError && <div>{paymentError}</div>}
//               <button
//                 type="button"
//                 className="sp-top-link"
//                 style={{ marginTop: 10 }}
//                 onClick={() => {
//                   loadBookings();
//                   loadPayments();
//                 }}
//               >
//                 Try again
//               </button>
//             </div>
//           )}

//           <section className="sp-welcome-row">
//             <div className="sp-welcome">
//               <p className="sp-eyebrow">STUDENT DASHBOARD</p>
//               <h1>
//                 Welcome back, <span>{firstName}!</span> 👋
//               </h1>
//               <p>
//                 Your mentorship journey starts with the right guidance.
//                 Discover mentors, manage your sessions, and keep moving
//                 toward your goals.
//               </p>
//             </div>

//             <div className="sp-profile-mini">
//               <span className="sp-avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
//                 {initial}
//               </span>
//               <div className="sp-profile-mini-info">
//                 <strong>{name}</strong>
//                 <span>{user?.email || "THRONE8 Student Account"}</span>
//                 <span className="sp-role">Student</span>
//               </div>
//             </div>
//           </section>

//           <div className="sp-section-head">
//             <div>
//               <h2>Your Overview</h2>
//               <p>Your mentorship activity at a glance.</p>
//             </div>
//             <button
//               type="button"
//               className="sp-top-link"
//               onClick={() => {
//                 loadBookings();
//                 loadPayments();
//               }}
//             >
//               ↻ Refresh
//             </button>
//           </div>

//           <section className="sp-stats">
//             <article className="sp-stat">
//               <div className="sp-stat-top">
//                 <span className="sp-stat-label">Total Bookings</span>
//                 <span className="sp-stat-icon">▦</span>
//               </div>
//               <strong className="sp-stat-value">
//                 {loadingBookings ? "…" : bookings.length}
//               </strong>
//               <p className="sp-stat-note">All your mentorship bookings</p>
//             </article>

//             <article className="sp-stat">
//               <div className="sp-stat-top">
//                 <span className="sp-stat-label">Upcoming Sessions</span>
//                 <span className="sp-stat-icon">◷</span>
//               </div>
//               <strong className="sp-stat-value">
//                 {loadingBookings ? "…" : upcomingBookings.length}
//               </strong>
//               <p className="sp-stat-note">Scheduled or confirmed sessions</p>
//             </article>

//             <article className="sp-stat">
//               <div className="sp-stat-top">
//                 <span className="sp-stat-label">Completed Sessions</span>
//                 <span className="sp-stat-icon">✓</span>
//               </div>
//               <strong className="sp-stat-value">
//                 {loadingBookings ? "…" : completedBookings.length}
//               </strong>
//               <p className="sp-stat-note">Sessions marked completed</p>
//             </article>

//             <article className="sp-stat">
//               <div className="sp-stat-top">
//                 <span className="sp-stat-label">Total Spent</span>
//                 <span className="sp-stat-icon">₹</span>
//               </div>
//               <strong className="sp-stat-value">
//                 {loadingPayments ? "…" : currency(totalSpent)}
//               </strong>
//               <p className="sp-stat-note">Based on available payment records</p>
//             </article>
//           </section>

//           <section className="sp-main-grid">
//             <div className="sp-panel">
//               <div className="sp-panel-head">
//                 <div>
//                   <h2>Recent Bookings</h2>
//                   <p>Your latest mentorship activity</p>
//                 </div>
//                 <Link to="/my-bookings" className="sp-muted-link">
//                   View all →
//                 </Link>
//               </div>

//               {loadingBookings ? (
//                 <div className="sp-empty">Loading your bookings…</div>
//               ) : bookingError ? (
//                 <div className="sp-empty">Booking data is unavailable.</div>
//               ) : recentBookings.length === 0 ? (
//                 <div className="sp-empty">
//                   <span className="sp-empty-icon">✦</span>
//                   <strong>Your journey starts here</strong>
//                   You haven't got any bookings to show yet.
//                   <div>
//                     <Link to="/mentors">Find a Mentor →</Link>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="sp-table-wrap">
//                   <table className="sp-table">
//                     <thead>
//                       <tr>
//                         <th>MENTOR</th>
//                         <th>SESSION DATE</th>
//                         <th>STATUS</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {recentBookings.map((booking, index) => {
//                         const status = getStatus(booking);
//                         return (
//                           <tr key={booking?._id || booking?.id || index}>
//                             <td>{getMentorName(booking)}</td>
//                             <td>{getDate(booking)}</td>
//                             <td>
//                               <span className={`sp-status ${statusClass(status)}`}>
//                                 {prettyStatus(status)}
//                               </span>
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>

//             <div className="sp-panel">
//               <div className="sp-panel-head">
//                 <div>
//                   <h2>Quick Actions</h2>
//                   <p>Make the most of your account</p>
//                 </div>
//               </div>

//               <div className="sp-panel-body">
//                 <div className="sp-action-list">
//                   <Link to="/mentors" className="sp-action">
//                     <span className="sp-action-icon">⌕</span>
//                     <span className="sp-action-info">
//                       <strong>Find Mentors</strong>
//                       <span>Discover the right guide for your goals</span>
//                     </span>
//                     <span className="sp-action-arrow">›</span>
//                   </Link>

//                   <Link to="/my-bookings" className="sp-action">
//                     <span className="sp-action-icon">▦</span>
//                     <span className="sp-action-info">
//                       <strong>Manage Bookings</strong>
//                       <span>Review your mentorship sessions</span>
//                     </span>
//                     <span className="sp-action-arrow">›</span>
//                   </Link>

//                   <Link to="/my-payments" className="sp-action">
//                     <span className="sp-action-icon">₹</span>
//                     <span className="sp-action-info">
//                       <strong>Payment History</strong>
//                       <span>Check your available transactions</span>
//                     </span>
//                     <span className="sp-action-arrow">›</span>
//                   </Link>

//                   <a href="#student-profile" className="sp-action">
//                     <span className="sp-action-icon">◎</span>
//                     <span className="sp-action-info">
//                       <strong>My Profile</strong>
//                       <span>Review your account information</span>
//                     </span>
//                     <span className="sp-action-arrow">›</span>
//                   </a>
//                 </div>

//                 <div className="sp-tip">
//                   <strong>✦ Make your next move</strong>
//                   <p>
//                     Book a session with a mentor who understands your goals
//                     and take the next step in your professional journey.
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </section>

//           <section className="sp-bottom-grid">
//             <div className="sp-panel">
//               <div className="sp-panel-head">
//                 <div>
//                   <h2>Recent Payments</h2>
//                   <p>Your latest payment records</p>
//                 </div>
//                 <Link to="/my-payments" className="sp-muted-link">
//                   View all →
//                 </Link>
//               </div>

//               {loadingPayments ? (
//                 <div className="sp-empty">Loading payment records…</div>
//               ) : paymentError ? (
//                 <div className="sp-empty">Payment data is unavailable.</div>
//               ) : recentPayments.length === 0 ? (
//                 <div className="sp-empty">
//                   <span className="sp-empty-icon">₹</span>
//                   <strong>No payment records yet</strong>
//                   Your payment activity will appear here when available.
//                 </div>
//               ) : (
//                 <div className="sp-table-wrap">
//                   <table className="sp-table">
//                     <thead>
//                       <tr>
//                         <th>DATE</th>
//                         <th>AMOUNT</th>
//                         <th>STATUS</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {recentPayments.map((payment, index) => {
//                         const status = getStatus(payment);
//                         const amount = getAmount(payment);

//                         return (
//                           <tr key={payment?._id || payment?.id || index}>
//                             <td>{getDate(payment)}</td>
//                             <td>{amount === null ? "—" : `₹${amount}`}</td>
//                             <td>
//                               <span className={`sp-status ${statusClass(status)}`}>
//                                 {prettyStatus(status)}
//                               </span>
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>

//             <div className="sp-panel" id="student-profile">
//               <div className="sp-panel-head">
//                 <div>
//                   <h2>My Profile</h2>
//                   <p>Your account information</p>
//                 </div>
//               </div>

//               <div className="sp-profile-content">
//                 <div className="sp-profile-row">
//                   <span>Full Name</span>
//                   <strong>{name}</strong>
//                 </div>
//                 <div className="sp-profile-row">
//                   <span>Email Address</span>
//                   <strong>{user?.email || "Not available"}</strong>
//                 </div>
//                 <div className="sp-profile-row">
//                   <span>Account Type</span>
//                   <strong>Student</strong>
//                 </div>
//                 <div className="sp-profile-row">
//                   <span>Platform</span>
//                   <strong>THRONE8 Mentorship</strong>
//                 </div>
//               </div>
//             </div>
//           </section>

//           <footer className="sp-footer">
//             <strong>THRONE8</strong> · Empowering your journey through mentorship.
//             <br />
//             © {new Date().getFullYear()} THRONE8 Mentorship. All rights reserved.
//           </footer>
//         </main>
//       </div>
//     </div>
//   );
// }

// export default StudentDashboard;

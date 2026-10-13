
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

const styles = `
  * { box-sizing: border-box; }

  .mentor-page {
    min-height: 100vh;
    background: #080b16;
    color: #f4f4ff;
    font-family: Inter, system-ui, sans-serif;
  }

  .mentor-nav {
    min-height: 76px;
    padding: 18px 7%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    background: rgba(13, 17, 34, .96);
    border-bottom: 1px solid rgba(167, 139, 250, .17);
  }

  .mentor-brand {
    color: #c4b5fd;
    font-size: 25px;
    font-weight: 900;
    letter-spacing: 2px;
    text-decoration: none;
  }

  .mentor-nav-links {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .mentor-nav-links a {
    color: #c6c8dc;
    text-decoration: none;
    font-size: 14px;
  }

  .mentor-nav-links a:hover { color: #c4b5fd; }

  .mentor-logout, .mentor-refresh {
    border: 1px solid rgba(196, 181, 253, .4);
    background: transparent;
    color: #ddd6fe;
    padding: 10px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
  }

  .mentor-logout:hover, .mentor-refresh:hover {
    background: rgba(139, 92, 246, .16);
  }

  .mentor-main {
    max-width: 1240px;
    margin: auto;
    padding: 42px 24px 65px;
  }

  .mentor-hero {
    position: relative;
    overflow: hidden;
    padding: 40px;
    border-radius: 24px;
    background: linear-gradient(120deg, #17152f, #242052 55%, #30205d);
    border: 1px solid rgba(196, 181, 253, .2);
    margin-bottom: 28px;
  }

  .mentor-hero::after {
    content: "";
    position: absolute;
    width: 240px;
    height: 240px;
    right: -80px;
    top: -110px;
    border-radius: 50%;
    background: rgba(167, 139, 250, .16);
    pointer-events: none;
  }

  .mentor-eyebrow {
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .mentor-hero h1 {
    font-size: clamp(29px, 4vw, 43px);
    margin: 14px 0 12px;
    letter-spacing: -1px;
    overflow-wrap: anywhere;
  }

  .mentor-hero p {
    max-width: 660px;
    color: #c6c4df;
    line-height: 1.8;
    margin: 0;
    font-size: 14px;
  }

  .mentor-section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin: 35px 0 20px;
  }

  .mentor-section-heading h2 {
    font-size: 21px;
    margin: 0 0 7px;
  }

  .mentor-section-heading p {
    color: #969bb8;
    font-size: 13px;
    margin: 0;
    line-height: 1.7;
  }

  .mentor-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 17px;
    margin-bottom: 35px;
  }

  .mentor-stat {
    background: linear-gradient(145deg, #12182b, #101426);
    border: 1px solid #262c48;
    padding: 22px;
    border-radius: 18px;
    min-width: 0;
  }

  .mentor-stat-label {
    color: #a3a8c2;
    font-size: 13px;
    margin-bottom: 14px;
  }

  .mentor-stat-value {
    color: #f4f4ff;
    font-size: clamp(23px, 3vw, 31px);
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .mentor-stat-note {
    margin-top: 9px;
    color: #969bb8;
    font-size: 12px;
  }

  .mentor-panel {
    background: linear-gradient(145deg, #12182b, #101426);
    border: 1px solid #262c48;
    border-radius: 20px;
    overflow: hidden;
    margin-bottom: 26px;
  }

  .mentor-panel-head {
    padding: 22px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    border-bottom: 1px solid #262c48;
  }

  .mentor-panel-head h3 {
    margin: 0 0 6px;
    font-size: 17px;
  }

  .mentor-panel-head p {
    color: #969bb8;
    margin: 0;
    font-size: 12px;
  }

  .mentor-filters {
    padding: 18px 24px;
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    border-bottom: 1px solid #262c48;
  }

  .mentor-filter {
    border: 1px solid #343a58;
    background: #11162a;
    color: #aeb3ce;
    border-radius: 9px;
    padding: 9px 13px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
  }

  .mentor-filter.active {
    background: rgba(139, 92, 246, .2);
    color: #ddd6fe;
    border-color: #8b5cf6;
  }

  .mentor-bookings {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    padding: 22px;
  }

  .mentor-booking {
    border: 1px solid #292f4b;
    border-radius: 15px;
    padding: 20px;
    background: rgba(8, 11, 22, .45);
    min-width: 0;
  }

  .mentor-booking-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 17px;
  }

  .mentor-booking h4 {
    margin: 0 0 6px;
    font-size: 16px;
    overflow-wrap: anywhere;
  }

  .mentor-booking-sub {
    color: #969bb8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .mentor-status {
    display: inline-block;
    border: 1px solid #343a58;
    color: #c6c8dc;
    background: #171d32;
    border-radius: 20px;
    padding: 6px 9px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .mentor-status.completed {
    color: #86efac;
    background: rgba(34, 197, 94, .1);
    border-color: rgba(34, 197, 94, .3);
  }

  .mentor-status.confirmed, .mentor-status.approved {
    color: #c4b5fd;
    background: rgba(139, 92, 246, .13);
    border-color: rgba(139, 92, 246, .3);
  }

  .mentor-status.cancelled, .mentor-status.rejected {
    color: #fca5a5;
    background: rgba(239, 68, 68, .1);
    border-color: rgba(239, 68, 68, .3);
  }

  .mentor-booking-details {
    display: grid;
    gap: 12px;
    margin-bottom: 18px;
  }

  .mentor-detail-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    font-size: 12px;
  }

  .mentor-detail-row span:first-child { color: #969bb8; }

  .mentor-detail-row span:last-child {
    text-align: right;
    color: #e2e4f5;
    overflow-wrap: anywhere;
  }

  .mentor-complete-btn {
    width: 100%;
    border: 0;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(100deg, #7c3aed, #6d5ce8);
    color: white;
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
  }

  .mentor-complete-btn:hover { filter: brightness(1.12); }

  .mentor-complete-btn:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .mentor-empty {
    padding: 42px 20px;
    text-align: center;
    color: #969bb8;
    line-height: 1.8;
    grid-column: 1 / -1;
    font-size: 13px;
  }

  .mentor-error {
    padding: 13px 16px;
    border-radius: 12px;
    margin-bottom: 18px;
    border: 1px solid rgba(248, 113, 113, .3);
    color: #fca5a5;
    background: rgba(127, 29, 29, .15);
    font-size: 13px;
  }

  .mentor-success {
    padding: 13px 16px;
    border-radius: 12px;
    margin-bottom: 18px;
    border: 1px solid rgba(74, 222, 128, .3);
    color: #86efac;
    background: rgba(20, 83, 45, .15);
    font-size: 13px;
  }

  .mentor-payout-list {
    padding: 0 24px;
  }

  .mentor-payout {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    padding: 17px 0;
    border-bottom: 1px solid #252b45;
  }

  .mentor-payout:last-child { border-bottom: 0; }

  .mentor-payout strong {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
    overflow-wrap: anywhere;
  }

  .mentor-payout small {
    color: #969bb8;
    font-size: 11px;
  }

  .mentor-payout-amount {
    font-size: 15px;
    font-weight: 800;
    text-align: right;
    white-space: nowrap;
  }

  .mentor-payout-status {
    margin-top: 5px;
    text-align: right;
    color: #c4b5fd;
    font-size: 11px;
    text-transform: capitalize;
  }

  .mentor-footer {
    padding: 25px;
    text-align: center;
    color: #777e9d;
    border-top: 1px solid #1e243b;
    font-size: 13px;
    line-height: 1.8;
  }

  @media (max-width: 900px) {
    .mentor-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mentor-bookings { grid-template-columns: 1fr; }
  }

  @media (max-width: 600px) {
    .mentor-nav { padding: 17px 20px; }
    .mentor-nav-links { gap: 12px; }
    .mentor-nav-links a { font-size: 12px; }
    .mentor-main { padding: 28px 15px 45px; }
    .mentor-hero { padding: 28px 22px; }
    .mentor-stats { gap: 10px; }
    .mentor-stat { padding: 16px; }
    .mentor-panel-head { padding: 18px; }
    .mentor-filters { padding: 15px; }
    .mentor-bookings { padding: 14px; }
    .mentor-booking { padding: 16px; }
    .mentor-payout-list { padding: 0 16px; }
  }
`;

const FILTERS = [
  "All",
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
  "Other",
];

const getList = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.payouts)) return data.payouts;
  if (Array.isArray(data?.earnings)) return data.earnings;
  return [];
};

const getStatus = (booking) =>
  String(
    booking?.status ||
      booking?.bookingStatus ||
      booking?.paymentStatus ||
      "pending"
  ).toLowerCase();

const getStudentName = (booking) => {
  const student =
    booking?.student ||
    booking?.user ||
    booking?.studentId ||
    booking?.userId;

  if (typeof student === "string") return student;
  return (
    student?.name ||
    student?.fullName ||
    student?.username ||
    booking?.studentName ||
    booking?.userName ||
    "Student"
  );
};

const getDate = (booking) => {
  const value =
    booking?.date ||
    booking?.sessionDate ||
    booking?.bookingDate ||
    booking?.slotDate;

  if (!value) return "Date not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getTime = (booking) =>
  booking?.time ||
  booking?.slot ||
  booking?.sessionTime ||
  booking?.startTime ||
  "Time not specified";

const getAmount = (item) => {
  const value =
    item?.amount ??
    item?.price ??
    item?.totalAmount ??
    item?.earnings ??
    item?.fee ??
    0;

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const getBookingId = (booking) =>
  booking?._id || booking?.id || booking?.bookingId;

const getSlotEnd = (booking) => {
  const dateValue =
    booking?.date ||
    booking?.sessionDate ||
    booking?.bookingDate ||
    booking?.slotDate;

  const endValue =
    booking?.slotEnd ||
    booking?.endTime ||
    booking?.sessionEndTime;

  if (!dateValue || !endValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  if (typeof endValue === "string" && endValue.includes("T")) {
    const fullDate = new Date(endValue);
    return Number.isNaN(fullDate.getTime()) ? null : fullDate;
  }

  const match = String(endValue).match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function MentorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayName =
    user?.name || user?.fullName || user?.username || "Mentor";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const errors = [];

    try {
      const response = await api.get("/mentors/my-bookings");
      setBookings(getList(response));
    } catch (err) {
      errors.push(
        err?.response?.data?.message || "Bookings load nahi ho paayin."
      );
      setBookings([]);
    }

    try {
      const response = await api.get("/mentors/earnings");
      const data = response?.data;
      setEarnings(data?.earnings ?? data?.data ?? data ?? null);

      if (Array.isArray(data?.payouts)) {
        setPayouts(data.payouts);
      } else if (Array.isArray(data?.payoutHistory)) {
        setPayouts(data.payoutHistory);
      } else if (Array.isArray(data?.history)) {
        setPayouts(data.history);
      } else {
        setPayouts([]);
      }
    } catch (err) {
      errors.push(
        err?.response?.data?.message || "Earnings load nahi ho paayin."
      );
      setEarnings(null);
      setPayouts([]);
    }

    if (errors.length) setError(errors.join(" "));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      setError("Logout nahi ho paya. Dobara try karein.");
    }
  };

  const handleComplete = async (booking) => {
    const bookingId = getBookingId(booking);

    if (!bookingId) {
      setError("Booking ID nahi mili, is session ko complete nahi kar sakte.");
      return;
    }

    const end = getSlotEnd(booking);

    if (!end) {
      setError(
        "Session ka end time nahi mil raha. Booking details mein date aur slotEnd/endTime check karein."
      );
      return;
    }

    if (new Date() < end) {
      setError(
        `Session ${end.toLocaleString("en-IN")} se pehle complete nahi kiya ja sakta.`
      );
      return;
    }

    setCompletingId(String(bookingId));
    setError("");
    setSuccess("");

    try {
      await api.patch(`/bookings/${bookingId}/complete`);
      setSuccess("Session successfully complete ho gaya!");
      await loadDashboard();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Session complete nahi hua. Please dobara try karein."
      );
    } finally {
      setCompletingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    if (filter === "All") return bookings;

    return bookings.filter((booking) => {
      const status = getStatus(booking);

      if (filter === "Pending") return status === "pending";
      if (filter === "Confirmed")
        return ["confirmed", "approved", "accepted", "booked"].includes(status);
      if (filter === "Completed")
        return ["completed", "complete"].includes(status);
      if (filter === "Cancelled")
        return ["cancelled", "canceled", "rejected"].includes(status);

      return ![
        "pending",
        "confirmed",
        "approved",
        "accepted",
        "booked",
        "completed",
        "complete",
        "cancelled",
        "canceled",
        "rejected",
      ].includes(status);
    });
  }, [bookings, filter]);

  const countByStatus = (statuses) =>
    bookings.filter((booking) => statuses.includes(getStatus(booking))).length;

  const totalBookings = bookings.length;
  const pendingBookings = countByStatus(["pending"]);
  const completedBookings = countByStatus(["completed", "complete"]);

  const earningsAmount = (() => {
    if (typeof earnings === "number" || typeof earnings === "string") {
      return Number(earnings) || 0;
    }

    return Number(
      earnings?.totalEarnings ??
        earnings?.total ??
        earnings?.earned ??
        earnings?.availableBalance ??
        earnings?.balance ??
        earnings?.amount ??
        0
    ) || 0;
  })();

  const isCompleteAllowed = (booking) => {
    const status = getStatus(booking);
    if (["completed", "complete", "cancelled", "canceled", "rejected"].includes(status)) {
      return false;
    }

    const end = getSlotEnd(booking);
    return Boolean(end && new Date() >= end);
  };

  return (
    <div className="mentor-page">
      <style>{styles}</style>

      <nav className="mentor-nav">
        <Link to="/" className="mentor-brand">THRONE8</Link>

        <div className="mentor-nav-links">
          <Link to="/">Home</Link>
          <Link to="/mentor-dashboard">Dashboard</Link>
          <button className="mentor-logout" onClick={handleLogout}>
            Logout ↗
          </button>
        </div>
      </nav>

      <main className="mentor-main">
        <section className="mentor-hero">
          <div className="mentor-eyebrow">Mentor Workspace</div>
          <h1>Welcome back, {displayName}!</h1>
          <p>
            Manage your mentorship sessions, track your earnings, and keep
            your student appointments organized — all from one place.
          </p>
        </section>

        {error && <div className="mentor-error">{error}</div>}
        {success && <div className="mentor-success">{success}</div>}

        <section className="mentor-stats">
          <div className="mentor-stat">
            <div className="mentor-stat-label">Total Bookings</div>
            <div className="mentor-stat-value">
              {loading ? "—" : totalBookings}
            </div>
            <div className="mentor-stat-note">All your student sessions</div>
          </div>

          <div className="mentor-stat">
            <div className="mentor-stat-label">Pending Requests</div>
            <div className="mentor-stat-value">
              {loading ? "—" : pendingBookings}
            </div>
            <div className="mentor-stat-note">Awaiting your attention</div>
          </div>

          <div className="mentor-stat">
            <div className="mentor-stat-label">Completed Sessions</div>
            <div className="mentor-stat-value">
              {loading ? "—" : completedBookings}
            </div>
            <div className="mentor-stat-note">Successfully completed</div>
          </div>

          <div className="mentor-stat">
            <div className="mentor-stat-label">Total Earnings</div>
            <div className="mentor-stat-value">
              {loading ? "—" : formatCurrency(earningsAmount)}
            </div>
            <div className="mentor-stat-note">Based on your earnings API</div>
          </div>
        </section>

        <section className="mentor-panel">
          <div className="mentor-panel-head">
            <div>
              <h3>Student Bookings</h3>
              <p>Review your sessions and update their completion status.</p>
            </div>

            <button
              className="mentor-refresh"
              onClick={loadDashboard}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          <div className="mentor-filters">
            {FILTERS.map((item) => (
              <button
                key={item}
                className={`mentor-filter ${filter === item ? "active" : ""}`}
                onClick={() => setFilter(item)}
              >
                {item}
                {item === "All" ? ` (${bookings.length})` : ""}
              </button>
            ))}
          </div>

          <div className="mentor-bookings">
            {loading ? (
              <div className="mentor-empty">Loading your bookings...</div>
            ) : filteredBookings.length === 0 ? (
              <div className="mentor-empty">
                <div style={{ fontSize: 30, marginBottom: 12 }}>▤</div>
                <strong>No bookings found</strong>
                <div>
                  {filter === "All"
                    ? "Your student bookings will appear here when available."
                    : `There are no ${filter.toLowerCase()} bookings right now.`}
                </div>
              </div>
            ) : (
              filteredBookings.map((booking, index) => {
                const bookingId = getBookingId(booking);
                const status = getStatus(booking);
                const canComplete = isCompleteAllowed(booking);

                return (
                  <article
                    className="mentor-booking"
                    key={bookingId || `${getStudentName(booking)}-${index}`}
                  >
                    <div className="mentor-booking-top">
                      <div>
                        <h4>{getStudentName(booking)}</h4>
                        <div className="mentor-booking-sub">
                          Booking ID: {bookingId || "Not available"}
                        </div>
                      </div>

                      <span className={`mentor-status ${status}`}>
                        {status}
                      </span>
                    </div>

                    <div className="mentor-booking-details">
                      <div className="mentor-detail-row">
                        <span>Session date</span>
                        <span>{getDate(booking)}</span>
                      </div>

                      <div className="mentor-detail-row">
                        <span>Session time</span>
                        <span>{getTime(booking)}</span>
                      </div>

                      <div className="mentor-detail-row">
                        <span>Session amount</span>
                        <span>{formatCurrency(getAmount(booking))}</span>
                      </div>

                      <div className="mentor-detail-row">
                        <span>Payment status</span>
                        <span>
                          {booking?.paymentStatus ||
                            booking?.payment?.status ||
                            "Not specified"}
                        </span>
                      </div>
                    </div>

                    {["completed", "complete"].includes(status) ? (
                      <button className="mentor-complete-btn" disabled>
                        ✓ Session Completed
                      </button>
                    ) : (
                      <button
                        className="mentor-complete-btn"
                        disabled={!canComplete || completingId === String(bookingId)}
                        onClick={() => handleComplete(booking)}
                        title={
                          canComplete
                            ? "Mark this session as completed"
                            : "This option becomes available after the session end time"
                        }
                      >
                        {completingId === String(bookingId)
                          ? "Completing..."
                          : canComplete
                          ? "✓ Mark Session Complete"
                          : "Complete After Session Ends"}
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="mentor-panel">
          <div className="mentor-panel-head">
            <div>
              <h3>Earnings & Payout History</h3>
              <p>Review your available earnings and recent payout records.</p>
            </div>
          </div>

          {loading ? (
            <div className="mentor-empty">Loading earnings...</div>
          ) : payouts.length === 0 ? (
            <div className="mentor-empty">
              No payout history available yet.
            </div>
          ) : (
            <div className="mentor-payout-list">
              {payouts.map((payout, index) => {
                const payoutId = payout?._id || payout?.id || index;
                const payoutStatus =
                  payout?.status || payout?.payoutStatus || "pending";

                return (
                  <div className="mentor-payout" key={payoutId}>
                    <div>
                      <strong>
                        {payout?.reference ||
                          payout?.transactionId ||
                          payout?.description ||
                          `Payout #${index + 1}`}
                      </strong>
                      <small>
                        {getDate(payout)}
                      </small>
                    </div>

                    <div>
                      <div className="mentor-payout-amount">
                        {formatCurrency(getAmount(payout))}
                      </div>
                      <div className="mentor-payout-status">
                        {payoutStatus}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="mentor-footer">
        <strong>THRONE8</strong>
        <div>Empowering your journey through mentorship.</div>
        <div>© {new Date().getFullYear()} THRONE8. All rights reserved.</div>
      </footer>
    </div>
  );
}


import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const FILTERS = [
  { label: "All Sessions", value: "ALL" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Needs Completion", value: "NEEDS_COMPLETION" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Pending Payment", value: "PENDING_PAYMENT" },
];

function MentorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [error, setError] = useState("");
  const [earningsError, setEarningsError] = useState("");
  const [success, setSuccess] = useState("");
  const [completingId, setCompletingId] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/mentors/my-bookings");
      setBookings(response.data.bookings || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load mentor bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      setEarningsLoading(true);
      setEarningsError("");

      const response = await api.get("/mentors/earnings");
      setEarnings(response.data);
    } catch (err) {
      setEarningsError(
        err.response?.data?.message ||
          "Failed to load earnings."
      );
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const refreshDashboard = async () => {
    await Promise.all([fetchBookings(), fetchEarnings()]);
  };

  useEffect(() => {
    fetchBookings();
    fetchEarnings();
  }, [fetchBookings, fetchEarnings]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCompleteSession = async (booking) => {
    if (booking.status !== "CONFIRMED") {
      setError("Only confirmed bookings can be completed.");
      return;
    }

    if (
      !booking.slotEnd ||
      new Date(booking.slotEnd).getTime() > Date.now()
    ) {
      setError("You can complete the session after its end time.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to mark this session as completed?"
    );

    if (!confirmed) return;

    try {
      setCompletingId(booking._id);
      setError("");
      setSuccess("");

      const response = await api.patch(
        `/bookings/${booking._id}/complete`
      );

      setSuccess(
        response.data.message ||
          "Mentor session completed successfully."
      );

      await refreshDashboard();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to complete the session."
      );
    } finally {
      setCompletingId("");
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
  };

  const formatPrice = (paise = 0) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(paise || 0) / 100);

  const summary = earnings?.summary || {};
  const payoutHistory = Array.isArray(earnings?.payoutHistory)
    ? earnings.payoutHistory
    : [];

  const counts = useMemo(() => {
    const now = Date.now();

    return {
      ALL: bookings.length,
      UPCOMING: bookings.filter(
        (b) =>
          b.status === "CONFIRMED" &&
          b.slotEnd &&
          new Date(b.slotEnd).getTime() > now
      ).length,
      NEEDS_COMPLETION: bookings.filter(
        (b) =>
          b.status === "CONFIRMED" &&
          b.slotEnd &&
          new Date(b.slotEnd).getTime() <= now
      ).length,
      COMPLETED: bookings.filter(
        (b) => b.status === "COMPLETED"
      ).length,
      EXPIRED: bookings.filter(
        (b) => b.status === "EXPIRED"
      ).length,
      PENDING_PAYMENT: bookings.filter(
        (b) => b.status === "PENDING_PAYMENT"
      ).length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const now = Date.now();

    return bookings.filter((booking) => {
      if (activeFilter === "ALL") return true;

      if (activeFilter === "UPCOMING") {
        return (
          booking.status === "CONFIRMED" &&
          booking.slotEnd &&
          new Date(booking.slotEnd).getTime() > now
        );
      }

      if (activeFilter === "NEEDS_COMPLETION") {
        return (
          booking.status === "CONFIRMED" &&
          booking.slotEnd &&
          new Date(booking.slotEnd).getTime() <= now
        );
      }

      return booking.status === activeFilter;
    });
  }, [bookings, activeFilter]);

  const earningCards = [
    {
      label: "Total Completed Earnings",
      amount: summary.totalCompletedEarningsPaise,
      detail: `${summary.completedSessions || 0} completed session(s)`,
      type: "total",
    },
    {
      label: "Pending Eligibility",
      amount: summary.pendingEarningsPaise,
      detail: "Waiting for the 15-day period",
    },
    {
      label: "Eligible Unpaid",
      amount: summary.eligibleUnpaidEarningsPaise,
      detail: "Eligible, not yet paid",
    },
    {
      label: "Pending Approval",
      amount: summary.payoutPendingPaise,
      detail: "Waiting for admin approval",
    },
    {
      label: "Approved",
      amount: summary.payoutApprovedPaise,
      detail: "Approved for processing",
    },
    {
      label: "Processing",
      amount: summary.payoutProcessingPaise,
      detail: "Payout being processed",
    },
    {
      label: "Total Paid",
      amount: summary.totalPaidPaise,
      detail: "Recorded as paid",
    },
    {
      label: "Failed Payouts",
      amount: summary.payoutFailedPaise,
      detail: "Requires review",
    },
  ];

  return (
    <main className="auth-page mentor-dashboard">
      <style>{`
        .mentor-dashboard {
          min-height: 100vh;
          padding: 38px 18px 64px;
          background:
            radial-gradient(ellipse at 90% 0%, #383326 0%, transparent 38%),
            #111210;
          color: #f4f1eb;
        }

        .mentor-dashboard-card {
          width: min(1120px, 100%);
          max-width: 1120px;
          box-sizing: border-box;
          margin: 0 auto;
          padding: clamp(20px, 4vw, 38px);
          background: rgba(27, 28, 24, 0.97);
          border: 1px solid #424033;
          border-radius: 20px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
        }

        .mentor-dashboard .mentor-dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding-bottom: 28px;
          border-bottom: 1px solid #34352e;
        }

        .mentor-dashboard .eyebrow {
          margin: 0 0 10px;
          color: #d7b779;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2.3px;
        }

        .mentor-dashboard .mentor-dashboard-header h1 {
          margin: 0;
          color: #f4f1eb;
          font-family: "Manrope", sans-serif;
          font-size: clamp(28px, 4vw, 38px);
          letter-spacing: -1px;
        }

        .mentor-dashboard .mentor-dashboard-header p:last-child {
          margin: 10px 0 0;
          color: #aaa99f;
        }

        .mentor-dashboard button {
          cursor: pointer;
        }

        .mentor-dashboard .btn {
          min-height: 42px;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 700;
          transition: background .2s ease, border-color .2s ease;
        }

        .mentor-dashboard .btn-outline {
          background: transparent;
          color: #e7d2a4;
          border: 1px solid #65563a;
        }

        .mentor-dashboard .btn-outline:hover:not(:disabled) {
          background: #302c21;
          border-color: #d7b779;
        }

        .mentor-dashboard .btn-primary {
          background: #d7b779;
          color: #171610;
          border: 1px solid #d7b779;
        }

        .mentor-dashboard .btn-primary:hover:not(:disabled) {
          background: #e7ca91;
        }

        .mentor-dashboard button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .mentor-dashboard .mentor-stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin: 26px 0 36px;
        }

        .mentor-dashboard .mentor-stat {
          min-width: 0;
          padding: 18px;
          background: #151612;
          border: 1px solid #34352e;
          border-radius: 12px;
        }

        .mentor-dashboard .mentor-stat span {
          display: block;
          color: #aaa99f;
          font-size: 12px;
          line-height: 1.5;
        }

        .mentor-dashboard .mentor-stat h2 {
          margin: 10px 0 0;
          color: #d7b779;
          font-family: "Manrope", sans-serif;
          font-size: 29px;
        }

        .mentor-dashboard .mentor-earnings-section {
          margin: 0 0 42px;
          padding: clamp(16px, 3vw, 26px);
          background: #151612;
          border: 1px solid #393a32;
          border-radius: 16px;
        }

        .mentor-dashboard .mentor-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .mentor-dashboard .mentor-section-heading h2,
        .mentor-dashboard .mentor-bookings-title {
          margin: 0;
          color: #f4f1eb;
          font-family: "Manrope", sans-serif;
          font-size: clamp(21px, 3vw, 27px);
        }

        .mentor-dashboard .mentor-section-heading p {
          margin: 8px 0 0;
          color: #aaa99f;
          font-size: 14px;
          line-height: 1.6;
        }

        .mentor-dashboard .mentor-earnings-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin: 22px 0;
        }

        .mentor-dashboard .mentor-earning-card {
          min-width: 0;
          padding: 18px 15px;
          background: linear-gradient(145deg, #22231e, #1a1b17);
          border: 1px solid #424033;
          border-radius: 12px;
          transition: border-color .2s ease, transform .2s ease;
        }

        .mentor-dashboard .mentor-earning-card:hover {
          border-color: #806b43;
          transform: translateY(-2px);
        }

        .mentor-dashboard .mentor-earning-card.total {
          background: linear-gradient(145deg, #393020, #222019);
          border-color: #806b43;
        }

        .mentor-dashboard .mentor-earning-card span {
          display: block;
          color: #c2bfb3;
          font-size: 12px;
          line-height: 1.6;
          min-height: 38px;
        }

        .mentor-dashboard .mentor-earning-card strong {
          display: block;
          margin: 10px 0;
          color: #d7b779;
          font-size: clamp(19px, 2vw, 25px);
          font-family: "Manrope", sans-serif;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .mentor-earning-card small {
          display: block;
          color: #a3a398;
          font-size: 11px;
          line-height: 1.6;
        }

        .mentor-dashboard .mentor-finance-note {
          padding: 13px 15px;
          border-left: 3px solid #806b43;
          background: #1c1d18;
          color: #aaa99f;
          font-size: 12px;
          line-height: 1.8;
        }

        .mentor-dashboard .mentor-table-wrap {
          width: 100%;
          margin-top: 16px;
          overflow-x: auto;
          border: 1px solid #393a32;
          border-radius: 10px;
        }

        .mentor-dashboard .mentor-payout-table {
          width: 100%;
          min-width: 570px;
          border-collapse: collapse;
        }

        .mentor-dashboard .mentor-payout-table th,
        .mentor-dashboard .mentor-payout-table td {
          padding: 14px 12px;
          text-align: left;
          border-bottom: 1px solid #34352e;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .mentor-payout-table th {
          background: #22231e;
          color: #d7b779;
          font-weight: 700;
        }

        .mentor-dashboard .mentor-payout-table td {
          color: #d8d3c6;
        }

        .mentor-dashboard .mentor-payout-table tr:last-child td {
          border-bottom: 0;
        }

        .mentor-dashboard .mentor-bookings-title {
          margin-bottom: 18px;
        }

        .mentor-dashboard .mentor-filter-list {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 0 0 22px;
        }

        .mentor-dashboard .mentor-filter {
          padding: 9px 12px;
          border: 1px solid #424033;
          border-radius: 8px;
          background: #1b1c18;
          color: #c5c1b6;
          font-size: 12px;
          font-weight: 700;
        }

        .mentor-dashboard .mentor-filter.active {
          background: #d7b779;
          border-color: #d7b779;
          color: #171610;
        }

        .mentor-dashboard .mentor-filter-count {
          margin-left: 5px;
          opacity: .8;
        }

        .mentor-dashboard .mentor-bookings-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .mentor-dashboard .mentor-booking-card {
          min-width: 0;
          padding: 20px;
          background: #1b1c18;
          border: 1px solid #393a32;
          border-radius: 13px;
        }

        .mentor-dashboard .mentor-booking-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .mentor-dashboard .mentor-booking-top h3 {
          margin: 0 0 6px;
          color: #f4f1eb;
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .mentor-booking-top p {
          margin: 0;
          color: #aaa99f;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .booking-status {
          display: inline-block;
          flex-shrink: 0;
          padding: 6px 9px;
          border: 1px solid #424033;
          border-radius: 20px;
          background: #25251f;
          color: #d8d3c6;
          font-size: 10px;
          font-weight: 800;
        }

        .mentor-dashboard .status-confirmed {
          border-color: #65563a;
          background: #30291d;
          color: #e7c98b;
        }

        .mentor-dashboard .status-completed {
          border-color: #536347;
          background: #20291e;
          color: #b6d4a5;
        }

        .mentor-dashboard .status-expired,
        .mentor-dashboard .status-cancelled {
          border-color: #60413b;
          background: #30201e;
          color: #e5a69c;
        }

        .mentor-dashboard .status-pending_payment {
          border-color: #55564d;
          color: #d8d3c6;
        }

        .mentor-dashboard .mentor-booking-details {
          margin: 18px 0;
          padding: 14px 0;
          border-top: 1px solid #34352e;
          border-bottom: 1px solid #34352e;
        }

        .mentor-dashboard .mentor-booking-details p {
          margin: 9px 0;
          color: #b7b7ae;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .mentor-booking-details strong {
          color: #e7e3d8;
        }

        .mentor-dashboard .mentor-booking-action p {
          color: #aaa99f;
          font-size: 12px;
          line-height: 1.7;
        }

        .mentor-dashboard .mentor-message {
          padding: 12px 14px;
          margin: 16px 0;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .mentor-dashboard .mentor-message.error {
          background: #30201e;
          border: 1px solid #60413b;
          color: #ffb6ab;
        }

        .mentor-dashboard .mentor-message.success {
          background: #20291e;
          border: 1px solid #536347;
          color: #c6e4b8;
        }

        .mentor-dashboard .mentor-empty-state {
          padding: 28px 18px;
          border: 1px dashed #424033;
          border-radius: 12px;
          text-align: center;
          color: #aaa99f;
          line-height: 1.8;
        }

        .mentor-dashboard .mentor-back-button {
          margin-top: 30px;
        }

        @media (max-width: 850px) {
          .mentor-dashboard .mentor-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .mentor-dashboard .mentor-earnings-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .mentor-dashboard .mentor-bookings-list {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 480px) {
          .mentor-dashboard {
            padding: 18px 10px 36px;
          }

          .mentor-dashboard .mentor-dashboard-card {
            padding: 18px 13px;
            border-radius: 14px;
          }

          .mentor-dashboard .mentor-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
            margin: 20px 0 28px;
          }

          .mentor-dashboard .mentor-stat {
            padding: 13px;
          }

          .mentor-dashboard .mentor-stat h2 {
            font-size: 25px;
          }

          .mentor-dashboard .mentor-earning-card {
            padding: 13px 10px;
          }

          .mentor-dashboard .mentor-earning-card strong {
            font-size: 18px;
          }

          .mentor-dashboard .mentor-booking-card {
            padding: 15px 12px;
          }

          .mentor-dashboard .mentor-booking-top {
            flex-wrap: wrap;
          }
        }
      `}</style>

      <section className="auth-card mentor-dashboard-card">
        <header className="mentor-dashboard-header">
          <div>
            <p className="eyebrow">THRONE8 MENTOR PORTAL</p>
            <h1>Mentor Dashboard</h1>
            <p>Welcome, {user?.name || "Mentor"}!</p>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        {success && (
          <p className="mentor-message success" role="status">
            {success}
          </p>
        )}

        {error && (
          <div className="mentor-message error" role="alert">
            {error}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setError("");
                fetchBookings();
              }}
              style={{ marginLeft: 12 }}
            >
              Retry Bookings
            </button>
          </div>
        )}

        <section className="mentor-stats" aria-label="Booking summary">
          {[
            ["Total Bookings", bookings.length],
            ["Confirmed", counts.UPCOMING + counts.NEEDS_COMPLETION],
            ["Pending Payment", counts.PENDING_PAYMENT],
            ["Completed", counts.COMPLETED],
            ["Expired", counts.EXPIRED],
          ].map(([label, value]) => (
            <article className="mentor-stat" key={label}>
              <span>{label}</span>
              <h2>{value}</h2>
            </article>
          ))}
        </section>

        <section className="mentor-earnings-section">
          <div className="mentor-section-heading">
            <div>
              <h2>My Earnings</h2>
              <p>
                Track completed-session earnings and payout progress.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              disabled={loading || earningsLoading}
              onClick={refreshDashboard}
            >
              {loading || earningsLoading
                ? "Refreshing..."
                : "Refresh Dashboard"}
            </button>
          </div>

          {earningsError && (
            <div className="mentor-message error" role="alert">
              {earningsError}
              <button
                type="button"
                className="btn btn-outline"
                onClick={fetchEarnings}
                style={{ marginLeft: 12 }}
              >
                Retry Earnings
              </button>
            </div>
          )}

          {earningsLoading && <p>Loading earnings...</p>}

          {!earningsLoading && !earningsError && earnings && (
            <>
              <div className="mentor-earnings-grid">
                {earningCards.map((card) => (
                  <article
                    className={`mentor-earning-card ${
                      card.type || ""
                    }`}
                    key={card.label}
                  >
                    <span>{card.label}</span>
                    <strong>{formatPrice(card.amount)}</strong>
                    <small>{card.detail}</small>
                  </article>
                ))}
              </div>

              <p className="mentor-finance-note">
                Earnings are calculated from completed sessions.
                Payout eligibility starts 15 calendar days after
                completion. Eligibility does not mean payment has
                been made.
              </p>

              <h2 style={{ marginTop: 28, fontSize: 20 }}>
                Payout History
              </h2>

              {payoutHistory.length === 0 ? (
                <div className="mentor-empty-state">
                  <p>No payout records found yet.</p>
                  <p>
                    Your payout records will appear here when available.
                  </p>
                </div>
              ) : (
                <div className="mentor-table-wrap">
                  <table className="mentor-payout-table">
                    <thead>
                      <tr>
                        <th>Payout ID</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.map((payout, index) => (
                        <tr
                          key={payout._id || payout.id || index}
                        >
                          <td>{payout._id || payout.id || "—"}</td>
                          <td>{formatPrice(payout.amountPaise)}</td>
                          <td>{payout.status || "UNKNOWN"}</td>
                          <td>
                            {payout.createdAt
                              ? formatDate(payout.createdAt)
                              : "—"}
                          </td>
                          <td>
                            {payout.paidAt
                              ? formatDate(payout.paidAt)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!earningsLoading && !earningsError && !earnings && (
            <div className="mentor-empty-state">
              Earnings data is not available.
              <button
                type="button"
                className="btn btn-outline"
                onClick={fetchEarnings}
                style={{ marginLeft: 12 }}
              >
                Try Again
              </button>
            </div>
          )}
        </section>

        <section>
          <div className="mentor-section-heading" style={{ marginBottom: 20 }}>
            <div>
              <h2 className="mentor-bookings-title">
                My Session Bookings
              </h2>
              <p style={{ color: "#aaa99f", fontSize: 13, marginTop: 6 }}>
                Manage your sessions and track booking status.
              </p>
            </div>
          </div>

          <div className="mentor-filter-list" aria-label="Filter bookings">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`mentor-filter ${
                  activeFilter === filter.value ? "active" : ""
                }`}
                aria-pressed={activeFilter === filter.value}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
                <span className="mentor-filter-count">
                  {counts[filter.value]}
                </span>
              </button>
            ))}
          </div>

          {loading && <p>Loading bookings...</p>}

          {!loading && !error && bookings.length === 0 && (
            <div className="mentor-empty-state">
              No bookings found yet.
            </div>
          )}

          {!loading && bookings.length > 0 && filteredBookings.length === 0 && (
            <div className="mentor-empty-state">
              No sessions in this category.
              <p>Choose another filter to view your bookings.</p>
            </div>
          )}

          {!loading && filteredBookings.length > 0 && (
            <div className="mentor-bookings-list">
              {filteredBookings.map((booking) => {
                const isConfirmed = booking.status === "CONFIRMED";

                const sessionEnded =
                  booking.slotEnd &&
                  new Date(booking.slotEnd).getTime() <= Date.now();

                const isCompleting = completingId === booking._id;

                return (
                  <article
                    className="mentor-booking-card"
                    key={booking._id}
                  >
                    <div className="mentor-booking-top">
                      <div>
                        <h3>
                          {booking.studentId?.name || "Student"}
                        </h3>
                        <p>
                          {booking.studentId?.email ||
                            "Email unavailable"}
                        </p>
                      </div>

                      <span
                        className={`booking-status status-${(
                          booking.status || ""
                        ).toLowerCase()}`}
                      >
                        {(booking.status || "UNKNOWN").replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </div>

                    <div className="mentor-booking-details">
                      <p>
                        <strong>Start:</strong>{" "}
                        {formatDate(booking.slotStart)}
                      </p>
                      <p>
                        <strong>End:</strong>{" "}
                        {formatDate(booking.slotEnd)}
                      </p>
                      <p>
                        <strong>Session Fee:</strong>{" "}
                        {formatPrice(booking.pricePaise)}
                      </p>
                      <p>
                        <strong>Booking ID:</strong>{" "}
                        {booking._id}
                      </p>

                      {booking.completedAt && (
                        <p>
                          <strong>Completed At:</strong>{" "}
                          {formatDate(booking.completedAt)}
                        </p>
                      )}

                      {booking.payoutEligibleAt && (
                        <p>
                          <strong>Payout Eligible At:</strong>{" "}
                          {formatDate(booking.payoutEligibleAt)}
                        </p>
                      )}
                    </div>

                    {isConfirmed && (
                      <div className="mentor-booking-action">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!sessionEnded || isCompleting}
                          onClick={() => handleCompleteSession(booking)}
                        >
                          {isCompleting
                            ? "Completing..."
                            : !sessionEnded
                              ? "Session Not Ended"
                              : "Complete Session"}
                        </button>

                        {!sessionEnded && (
                          <p>
                            Session completion is available after{" "}
                            {formatDate(booking.slotEnd)}.
                          </p>
                        )}
                      </div>
                    )}

                    {booking.status === "COMPLETED" && (
                      <p className="mentor-message success">
                        Session completed successfully.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <button
          type="button"
          className="btn btn-outline mentor-back-button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </section>
    </main>
  );
}

export default MentorDashboard;

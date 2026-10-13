import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const financeMenu = [
  { label: "Finance summary", icon: "▦", section: "overview" },
  { label: "Transactions", icon: "↔", section: "transactions" },
  { label: "Commission", icon: "◈", section: "commission" },
  { label: "Earnings queue", icon: "◷", section: "earnings" },
  { label: "Disputes & refunds", icon: "↩", section: "refunds" },
  { label: "Failed payouts", icon: "!", section: "failed" },
  { label: "Reconciliation", icon: "⇄", section: "reconciliation" },
  { label: "Audit log", icon: "≡", section: "audit" },
];

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/stats");
      setStats(response.data.stats || {});
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load dashboard statistics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const handleVerificationUpdate = () => fetchStats();

    window.addEventListener(
      "mentor-verification-updated",
      handleVerificationUpdate
    );

    return () => {
      window.removeEventListener(
        "mentor-verification-updated",
        handleVerificationUpdate
      );
    };
  }, [fetchStats]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const cards = [
    {
      title: "Total Users",
      value: stats?.totalUsers,
      icon: "♙",
      color: "purple",
      description: "Registered platform users",
    },
    {
      title: "Total Students",
      value: stats?.totalStudents,
      icon: "♧",
      color: "blue",
      description: "Student accounts",
    },
    {
      title: "Total Mentors",
      value: stats?.totalMentors,
      icon: "♙",
      color: "green",
      description: "Mentor accounts",
    },
    {
      title: "Verified Mentors",
      value: stats?.verifiedMentors,
      icon: "✓",
      color: "green",
      description: "Verified and approved",
    },
    {
      title: "Pending Verifications",
      value: stats?.pendingMentorVerifications,
      icon: "◷",
      color: "yellow",
      description: "Awaiting admin review",
    },
    {
      title: "Total Bookings",
      value: stats?.totalBookings,
      icon: "▤",
      color: "purple",
      description: "All platform bookings",
    },
    {
      title: "Confirmed Bookings",
      value: stats?.confirmedBookings,
      icon: "✓",
      color: "blue",
      description: "Confirmed sessions",
    },
    {
      title: "Completed Bookings",
      value: stats?.completedBookings,
      icon: "★",
      color: "green",
      description: "Completed sessions",
    },
    {
      title: "Total Payments",
      value: stats?.totalPayments,
      icon: "₹",
      color: "purple",
      description: "Payment records",
    },
    {
      title: "Captured Payments",
      value: stats?.capturedPayments,
      icon: "↗",
      color: "green",
      description: "Successfully captured",
    },
    {
      title: "Total Revenue",
      value: `₹${formatNumber(stats?.totalRevenue)}`,
      icon: "₹",
      color: "blue",
      description: "Revenue reported by API",
    },
  ];

  const activeMenu = financeMenu.find(
    (item) => item.section === activeSection
  );

  const openSection = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="t8-admin">
      <style>{`
        .t8-admin {
          --bg: #0e1023;
          --panel: #171b35;
          --panel-hover: #202647;
          --border: #2b3158;
          --text: #f4f5ff;
          --muted: #9caee0;
          --purple: #9290ff;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: Inter, Arial, sans-serif;
          font-size: 15px;
        }

        .t8-admin * {
          box-sizing: border-box;
        }

        .t8-topbar {
          min-height: 74px;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          background: #171b35;
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 5;
        }

        .t8-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.7px;
        }

        .t8-brand-mark {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--purple);
          color: white;
          font-size: 15px;
          letter-spacing: 0;
        }

        .t8-prototype {
          padding: 7px 12px;
          border-radius: 20px;
          background: #0d1128;
          color: #a9b7ff;
          font-size: 12px;
          font-weight: 700;
        }

        .t8-topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .t8-role {
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 10px 15px;
          color: var(--muted);
          background: transparent;
          font: inherit;
          cursor: pointer;
        }

        .t8-role.active {
          color: white;
          border-color: var(--border);
          background: #10142b;
        }

        .t8-layout {
          display: grid;
          grid-template-columns: 252px minmax(0, 1fr);
          min-height: calc(100vh - 74px);
        }

        .t8-sidebar {
          padding: 22px 13px;
          background: #101225;
          border-right: 1px solid var(--border);
        }

        .t8-sidebar-label {
          padding: 0 14px;
          margin: 0 0 15px;
          color: #737fae;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .t8-menu {
          display: grid;
          gap: 5px;
        }

        .t8-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 13px 14px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #aab8e7;
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: background .2s, color .2s;
        }

        .t8-menu-item:hover {
          background: #1a1f3e;
          color: white;
        }

        .t8-menu-item.active {
          color: var(--purple);
          background: #252a50;
          font-weight: 700;
        }

        .t8-menu-icon {
          display: inline-grid;
          place-items: center;
          width: 22px;
          font-size: 19px;
        }

        .t8-sidebar-divider {
          height: 1px;
          background: var(--border);
          margin: 23px 5px;
        }

        .t8-sidebar-bottom {
          display: grid;
          gap: 8px;
        }

        .t8-sidebar-bottom button {
          width: 100%;
          text-align: left;
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 12px 14px;
          color: #aab8e7;
          background: transparent;
          cursor: pointer;
          font: inherit;
        }

        .t8-sidebar-bottom button:hover {
          background: #1a1f3e;
          color: white;
        }

        .t8-main {
          min-width: 0;
          padding: 30px;
          overflow: hidden;
        }

        .t8-page-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 26px;
        }

        .t8-eyebrow {
          margin: 0 0 9px;
          color: var(--purple);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .t8-page-heading h1 {
          margin: 0;
          font-size: clamp(25px, 3vw, 34px);
          letter-spacing: -.9px;
        }

        .t8-subtitle {
          margin: 10px 0 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .t8-button {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 15px;
          background: #202647;
          color: #dfe4ff;
          font: inherit;
          font-weight: 650;
          cursor: pointer;
          transition: filter .2s, transform .2s;
        }

        .t8-button:hover {
          filter: brightness(1.16);
        }

        .t8-button:active {
          transform: scale(.98);
        }

        .t8-button.primary {
          background: var(--purple);
          color: #101225;
          border-color: var(--purple);
        }

        .t8-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .t8-heading-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .t8-section-title {
          margin: 28px 0 16px;
          font-size: 19px;
          letter-spacing: -.3px;
        }

        .t8-section-description {
          margin: -7px 0 17px;
          color: var(--muted);
          line-height: 1.6;
        }

        .t8-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

        .t8-stat-card {
          min-width: 0;
          padding: 19px;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: var(--panel);
          border-left: 4px solid var(--purple);
          transition: transform .2s, background .2s;
        }

        .t8-stat-card:hover {
          transform: translateY(-2px);
          background: var(--panel-hover);
        }

        .t8-stat-card.blue { border-left-color: #6da8ff; }
        .t8-stat-card.green { border-left-color: #50d6a4; }
        .t8-stat-card.yellow { border-left-color: #f4bd4e; }
        .t8-stat-card.purple { border-left-color: #9290ff; }

        .t8-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .t8-stat-title {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .t8-stat-icon {
          display: grid;
          place-items: center;
          flex: 0 0 35px;
          width: 35px;
          height: 35px;
          border-radius: 10px;
          background: #282c53;
          color: var(--purple);
          font-size: 18px;
        }

        .t8-stat-value {
          margin: 15px 0 7px;
          overflow-wrap: anywhere;
          font-size: clamp(22px, 2.2vw, 29px);
          letter-spacing: -.8px;
          font-weight: 800;
        }

        .t8-stat-description {
          color: #8493c4;
          font-size: 12px;
          line-height: 1.5;
        }

        .t8-panel {
          padding: 23px;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: var(--panel);
        }

        .t8-panel h2,
        .t8-panel h3 {
          margin: 0 0 10px;
        }

        .t8-panel p {
          color: var(--muted);
          line-height: 1.7;
        }

        .t8-action-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
        }

        .t8-action-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          padding: 22px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--panel);
        }

        .t8-action-card h3 {
          margin: 0;
          font-size: 17px;
        }

        .t8-action-card p {
          flex: 1;
          margin: 0 0 9px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.7;
        }

        .t8-action-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #282c53;
          color: var(--purple);
          font-size: 21px;
        }

        .t8-notice {
          padding: 14px 16px;
          border: 1px solid #5a4720;
          border-radius: 11px;
          margin-bottom: 18px;
          background: #332b1a;
          color: #ffcf72;
          line-height: 1.6;
        }

        .t8-error {
          padding: 16px;
          border: 1px solid #713c4b;
          border-radius: 12px;
          margin-bottom: 18px;
          background: #351e30;
          color: #ffb8c6;
        }

        .t8-error p {
          margin-top: 0;
        }

        .t8-loading {
          padding: 32px;
          text-align: center;
          color: var(--muted);
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--panel);
        }

        .t8-footer {
          margin-top: 28px;
          padding: 20px 0 5px;
          border-top: 1px solid var(--border);
          color: #7f8bb5;
          font-size: 12px;
          line-height: 1.7;
        }

        @media (max-width: 1200px) {
          .t8-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .t8-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .t8-layout {
            grid-template-columns: 1fr;
          }

          .t8-sidebar {
            padding: 12px;
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }

          .t8-sidebar-label,
          .t8-sidebar-divider,
          .t8-sidebar-bottom {
            display: none;
          }

          .t8-menu {
            display: flex;
            gap: 7px;
            overflow-x: auto;
            padding-bottom: 2px;
          }

          .t8-menu-item {
            width: auto;
            flex: 0 0 auto;
            white-space: nowrap;
            padding: 11px 13px;
          }

          .t8-main {
            padding: 23px 18px;
          }

          .t8-topbar {
            padding: 12px 16px;
          }
        }

        @media (max-width: 560px) {
          .t8-topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .t8-brand {
            font-size: 21px;
          }

          .t8-prototype {
            font-size: 10px;
          }

          .t8-topbar-right {
            width: 100%;
          }

          .t8-role {
            flex: 1;
            padding: 9px 10px;
          }

          .t8-stats-grid,
          .t8-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .t8-stat-card {
            padding: 14px;
          }

          .t8-stat-value {
            font-size: 22px;
          }

          .t8-stat-title {
            font-size: 12px;
          }

          .t8-stat-icon {
            flex-basis: 29px;
            width: 29px;
            height: 29px;
            font-size: 15px;
          }

          .t8-panel {
            padding: 17px;
          }

          .t8-heading-actions {
            width: 100%;
          }

          .t8-heading-actions .t8-button {
            flex: 1;
          }
        }

        @media (max-width: 360px) {
          .t8-stats-grid,
          .t8-action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="t8-topbar">
        <div
          className="t8-brand"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <span className="t8-brand-mark">T8</span>
          <span>Throne8</span>
          <span className="t8-prototype">ADMIN PORTAL</span>
        </div>

        <div className="t8-topbar-right">
          <button
            type="button"
            className="t8-role"
            onClick={() => navigate("/dashboard")}
          >
            Student
          </button>
          <button
            type="button"
            className="t8-role"
            onClick={() => navigate("/mentor-dashboard")}
          >
            Mentor
          </button>
          <button
            type="button"
            className="t8-role active"
            aria-current="page"
          >
            Admin
          </button>
        </div>
      </header>

      <div className="t8-layout">
        <aside className="t8-sidebar">
          <p className="t8-sidebar-label">FINANCE & OPERATIONS</p>

          <nav className="t8-menu" aria-label="Admin navigation">
            {financeMenu.map((item) => (
              <button
                type="button"
                key={item.section}
                className={`t8-menu-item ${
                  activeSection === item.section ? "active" : ""
                }`}
                onClick={() => openSection(item.section)}
                aria-current={
                  activeSection === item.section ? "page" : undefined
                }
              >
                <span className="t8-menu-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="t8-sidebar-divider" />

          <p className="t8-sidebar-label">PLATFORM</p>

          <div className="t8-sidebar-bottom">
            <button
              type="button"
              onClick={() => navigate("/admin/mentors")}
            >
              ♙ &nbsp; Mentor management
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/payouts")}
            >
              ₹ &nbsp; Mentor payouts
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
            >
              ↖ &nbsp; Back to website
            </button>
            <button type="button" onClick={handleLogout}>
              ⇥ &nbsp; Logout
            </button>
          </div>
        </aside>

        <main className="t8-main">
          <div className="t8-page-heading">
            <div>
              <p className="t8-eyebrow">
                THRONE8 / ADMIN / FINANCE
              </p>
              <h1>
                {activeMenu?.label || "Admin Dashboard"}
              </h1>
              <p className="t8-subtitle">
                {activeSection === "overview"
                  ? `Welcome back, ${user?.name || "Admin"}. Here's your platform overview.`
                  : activeSection === "transactions"
                  ? "Review payment activity and transaction records."
                  : activeSection === "commission"
                  ? "Manage and review platform commission information."
                  : activeSection === "earnings"
                  ? "Monitor mentor earnings and payout eligibility."
                  : activeSection === "refunds"
                  ? "Review refund and dispute-related workflows."
                  : activeSection === "failed"
                  ? "Review payout records that may require attention."
                  : activeSection === "reconciliation"
                  ? "Compare provider transactions with recorded payment data."
                  : "Review platform activity and administrative events."}
              </p>
            </div>

            <div className="t8-heading-actions">
              <button
                type="button"
                className="t8-button"
                onClick={fetchStats}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </button>
              <button
                type="button"
                className="t8-button primary"
                onClick={() => navigate("/admin/payouts")}
              >
                ₹ Manage payouts
              </button>
            </div>
          </div>

          {error && (
            <div className="t8-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="t8-button"
                onClick={fetchStats}
                disabled={loading}
              >
                Try again
              </button>
            </div>
          )}

          {activeSection === "overview" && (
            <>
              <div className="t8-notice">
                <strong>Finance workspace</strong> — platform statistics
                are loaded from your existing backend. Use the payout
                management page for payout records and approvals.
              </div>

              <h2 className="t8-section-title">Platform Overview</h2>
              <p className="t8-section-description">
                A live overview of users, mentorship bookings and payments.
              </p>

              {loading && !stats ? (
                <div className="t8-loading">
                  Loading platform statistics...
                </div>
              ) : stats ? (
                <section className="t8-stats-grid">
                  {cards.map((card) => (
                    <article
                      className={`t8-stat-card ${card.color}`}
                      key={card.title}
                    >
                      <div className="t8-stat-top">
                        <span className="t8-stat-title">
                          {card.title}
                        </span>
                        <span className="t8-stat-icon">
                          {card.icon}
                        </span>
                      </div>
                      <div className="t8-stat-value">
                        {typeof card.value === "string"
                          ? card.value
                          : formatNumber(card.value)}
                      </div>
                      <div className="t8-stat-description">
                        {card.description}
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                !error && (
                  <div className="t8-loading">
                    No dashboard statistics are available yet.
                  </div>
                )
              )}

              <h2 className="t8-section-title">
                Quick Actions
              </h2>
              <p className="t8-section-description">
                Manage key parts of the THRONE8 mentorship platform.
              </p>

              <section className="t8-action-grid">
                <article className="t8-action-card">
                  <span className="t8-action-icon">♙</span>
                  <h3>Mentor Verification</h3>
                  <p>
                    Review mentor profiles and check verification requests.
                    {stats
                      ? ` ${formatNumber(stats.pendingMentorVerifications)} pending verification(s).`
                      : ""}
                  </p>
                  <button
                    type="button"
                    className="t8-button primary"
                    onClick={() => navigate("/admin/mentors")}
                  >
                    Manage mentors →
                  </button>
                </article>

                <article className="t8-action-card">
                  <span className="t8-action-icon">₹</span>
                  <h3>Mentor Payouts</h3>
                  <p>
                    View payout history, generate eligible payouts and
                    manage pending approvals.
                  </p>
                  <button
                    type="button"
                    className="t8-button primary"
                    onClick={() => navigate("/admin/payouts")}
                  >
                    Open payouts →
                  </button>
                </article>

                <article className="t8-action-card">
                  <span className="t8-action-icon">▤</span>
                  <h3>Booking Activity</h3>
                  <p>
                    Review overall booking totals and session completion
                    statistics reported by your API.
                  </p>
                  <div style={{ color: "#aab8e7", fontSize: 13 }}>
                    Total bookings: {formatNumber(stats?.totalBookings)}
                  </div>
                </article>
              </section>
            </>
          )}

          {activeSection !== "overview" && (
            <section className="t8-panel">
              <h2>{activeMenu?.label}</h2>
              <p>
                {activeSection === "transactions" &&
                  "Transaction search, payment status filters and gateway IDs can be added here when the transaction API is available."}
                {activeSection === "commission" &&
                  "Commission rates and commission history can be managed here once the commission endpoints are connected."}
                {activeSection === "earnings" &&
                  "Use Mentor Payouts to review eligible earnings and payout approvals."}
                {activeSection === "refunds" &&
                  "Refund requests and disputes need their corresponding backend endpoints before they can be displayed or updated here."}
                {activeSection === "failed" &&
                  "Open Mentor Payouts to review available payout records. Failed-payout filtering requires the corresponding records and status data."}
                {activeSection === "reconciliation" &&
                  "Provider-versus-ledger reconciliation needs a backend reconciliation endpoint and recorded discrepancy data."}
                {activeSection === "audit" &&
                  "An audit log should display real recorded actions, timestamps, actors and changes from the backend. No sample records are being presented as real activity."}
              </p>

              {(activeSection === "earnings" ||
                activeSection === "failed") && (
                <button
                  type="button"
                  className="t8-button primary"
                  onClick={() => navigate("/admin/payouts")}
                >
                  Open Mentor Payouts →
                </button>
              )}

              <div className="t8-footer">
                This section is a UI starting point. Connect the relevant
                backend endpoints to display and manage real records.
              </div>
            </section>
          )}

          <footer className="t8-footer">
            <strong>THRONE8</strong> · Mentorship Admin Portal
            <br />
            Signed in as {user?.name || "Admin"} · Finance data is
            provided by your connected API.
          </footer>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
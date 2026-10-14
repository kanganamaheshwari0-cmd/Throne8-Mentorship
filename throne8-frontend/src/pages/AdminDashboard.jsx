
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

const formatRupees = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const statusClass = (status) => {
  if (status === "CAPTURED") return "captured";
  if (
    ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status)
  ) return "failed";
  if (["CREATED", "AUTHORIZED"].includes(status)) return "pending";
  return "";
};

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  // Payment transactions
  const [transactions, setTransactions] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState({});
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("");
  const [transactionFrom, setTransactionFrom] = useState("");
  const [transactionTo, setTransactionTo] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPagination, setTransactionPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Commission overview, mentor rates and financial ledger
  const [commissionMentors, setCommissionMentors] = useState([]);
  const [commissionOverview, setCommissionOverview] = useState(null);
  const [commissionRecords, setCommissionRecords] = useState([]);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const [commissionMessage, setCommissionMessage] = useState("");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [commissionEdits, setCommissionEdits] = useState({});
  const [savingCommissionId, setSavingCommissionId] = useState("");
  const [commissionRecordsPage, setCommissionRecordsPage] = useState(1);
  const [commissionRecordsPagination, setCommissionRecordsPagination] =
    useState({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

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

  const fetchTransactions = useCallback(async () => {
    if (transactionFrom && transactionTo && transactionFrom > transactionTo) {
      setTransactionError("From date must be on or before the To date.");
      return;
    }

    try {
      setTransactionLoading(true);
      setTransactionError("");

      const response = await api.get("/admin/transactions", {
        params: {
          page: transactionPage,
          limit: 10,
          search: appliedSearch,
          status: transactionStatus,
          from: transactionFrom,
          to: transactionTo,
        },
      });

      setTransactions(
        Array.isArray(response.data.transactions)
          ? response.data.transactions
          : []
      );
      setTransactionSummary(response.data.summary || {});
      setTransactionPagination(
        response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      setTransactionError(
        err.response?.data?.message ||
          "Unable to load payment transactions."
      );
    } finally {
      setTransactionLoading(false);
    }
  }, [
    transactionPage,
    appliedSearch,
    transactionStatus,
    transactionFrom,
    transactionTo,
  ]);

  const fetchCommissionMentors = useCallback(async () => {
    try {
      setCommissionLoading(true);
      setCommissionError("");

      const [mentorsResponse, overviewResponse, recordsResponse] =
        await Promise.all([
          api.get("/admin/mentors"),
          api.get("/admin/commission-overview"),
          api.get("/admin/commission-records", {
            params: {
              page: commissionRecordsPage,
              limit: 20,
            },
          }),
        ]);

      const mentors = Array.isArray(mentorsResponse.data.mentors)
        ? mentorsResponse.data.mentors
        : Array.isArray(mentorsResponse.data.data)
          ? mentorsResponse.data.data
          : [];

      setCommissionMentors(mentors);
      setCommissionOverview(overviewResponse.data.overview || null);

      setCommissionRecords(
        Array.isArray(recordsResponse.data.records)
          ? recordsResponse.data.records
          : []
      );

      setCommissionRecordsPagination({
        page: recordsResponse.data.page || 1,
        limit: recordsResponse.data.limit || 20,
        total: recordsResponse.data.total || 0,
        totalPages: recordsResponse.data.totalPages || 0,
      });

      setCommissionEdits((previous) => {
        const next = { ...previous };
        mentors.forEach((mentor) => {
          if (next[mentor._id] === undefined) {
            next[mentor._id] = String(
              Number(mentor.commissionRateBps ?? 2000) / 100
            );
          }
        });
        return next;
      });
    } catch (err) {
      setCommissionError(
        err.response?.data?.message ||
          "Unable to load commission overview, mentor rates or ledger records."
      );
    } finally {
      setCommissionLoading(false);
    }
  }, [commissionRecordsPage]);

  const saveCommission = async (mentor) => {
    const rawValue = commissionEdits[mentor._id];
    const percentage = Number(rawValue);

    if (
      rawValue === "" ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    ) {
      setCommissionError("Commission rate must be between 0% and 100%.");
      setCommissionMessage("");
      return;
    }

    try {
      setSavingCommissionId(mentor._id);
      setCommissionError("");
      setCommissionMessage("");

      await api.patch(`/admin/mentors/${mentor._id}/commission`, {
        commissionRateBps: Math.round(percentage * 100),
      });

      setCommissionMessage(
        `Commission rate updated for ${
          mentor.userId?.name || mentor.name || "mentor"
        }. This rate applies to future bookings.`
      );

      // Refresh the saved rate and ledger without clearing the message.
      await fetchCommissionMentors();
    } catch (err) {
      setCommissionError(
        err.response?.data?.message ||
          "Unable to update commission rate."
      );
    } finally {
      setSavingCommissionId("");
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeSection === "transactions") fetchTransactions();
  }, [activeSection, fetchTransactions]);

  useEffect(() => {
    if (activeSection === "commission") fetchCommissionMentors();
  }, [activeSection, fetchCommissionMentors]);

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

  const handleTransactionSearch = (event) => {
    event.preventDefault();
    setTransactionPage(1);
    setAppliedSearch(transactionSearch.trim());
  };

  const resetTransactionFilters = () => {
    setTransactionSearch("");
    setAppliedSearch("");
    setTransactionStatus("");
    setTransactionFrom("");
    setTransactionTo("");
    setTransactionPage(1);
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

  const filteredCommissionMentors = commissionMentors.filter((mentor) => {
    const query = commissionSearch.trim().toLowerCase();
    const name = (
      mentor.userId?.name ||
      mentor.name ||
      ""
    ).toLowerCase();
    const email = (
      mentor.userId?.email ||
      mentor.email ||
      ""
    ).toLowerCase();

    return name.includes(query) || email.includes(query);
  });

  return (
    <div className="t8-admin">
      <style>{`
        .t8-admin{--bg:#0e1023;--panel:#171b35;--border:#2b3158;--text:#f4f5ff;--muted:#9caee0;--purple:#9290ff;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,Arial,sans-serif;font-size:15px}
        .t8-admin *{box-sizing:border-box}
        .t8-topbar{min-height:74px;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:#171b35;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:5}
        .t8-brand{display:flex;align-items:center;gap:11px;font-size:24px;font-weight:800;letter-spacing:-.7px}
        .t8-brand-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--purple);color:white;font-size:15px}
        .t8-prototype{padding:7px 12px;border-radius:20px;background:#0d1128;color:#a9b7ff;font-size:12px;font-weight:700}
        .t8-topbar-right{display:flex;align-items:center;gap:8px}
        .t8-role{border:1px solid transparent;border-radius:10px;padding:10px 15px;color:var(--muted);background:transparent;font:inherit;cursor:pointer}
        .t8-role.active{color:white;border-color:var(--border);background:#10142b}
        .t8-layout{display:grid;grid-template-columns:252px minmax(0,1fr);min-height:calc(100vh - 74px)}
        .t8-sidebar{padding:22px 13px;background:#101225;border-right:1px solid var(--border)}
        .t8-sidebar-label{padding:0 14px;margin:0 0 15px;color:#737fae;font-size:11px;font-weight:800;letter-spacing:1.5px}
        .t8-menu{display:grid;gap:5px}
        .t8-menu-item{display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;border:0;border-radius:10px;background:transparent;color:#aab8e7;text-align:left;font:inherit;cursor:pointer}
        .t8-menu-item:hover{background:#1a1f3e;color:white}
        .t8-menu-item.active{color:var(--purple);background:#252a50;font-weight:700}
        .t8-menu-icon{display:inline-grid;place-items:center;width:22px;font-size:19px}
        .t8-sidebar-divider{height:1px;background:var(--border);margin:23px 5px}
        .t8-sidebar-bottom{display:grid;gap:8px}
        .t8-sidebar-bottom button{width:100%;text-align:left;border:1px solid transparent;border-radius:9px;padding:12px 14px;color:#aab8e7;background:transparent;cursor:pointer;font:inherit}
        .t8-sidebar-bottom button:hover{background:#1a1f3e;color:white}
        .t8-main{min-width:0;padding:30px;overflow:hidden}
        .t8-page-heading{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:20px;margin-bottom:26px}
        .t8-eyebrow{margin:0 0 9px;color:var(--purple);font-size:11px;font-weight:800;letter-spacing:1.7px}
        .t8-page-heading h1{margin:0;font-size:clamp(25px,3vw,34px)}
        .t8-subtitle{margin:10px 0 0;color:var(--muted);line-height:1.7}
        .t8-button{border:1px solid var(--border);border-radius:10px;padding:11px 15px;background:#202647;color:#dfe4ff;font:inherit;font-weight:650;cursor:pointer}
        .t8-button:hover{filter:brightness(1.16)}
        .t8-button.primary{background:var(--purple);color:#101225;border-color:var(--purple)}
        .t8-button:disabled{opacity:.6;cursor:not-allowed}
        .t8-heading-actions{display:flex;gap:9px;flex-wrap:wrap}
        .t8-section-title{margin:28px 0 16px;font-size:19px}
        .t8-section-description{margin:-7px 0 17px;color:var(--muted);line-height:1.6}
        .t8-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}
        .t8-stat-card{min-width:0;padding:19px;border:1px solid var(--border);border-radius:15px;background:var(--panel);border-left:4px solid var(--purple)}
        .t8-stat-card.blue{border-left-color:#6da8ff}.t8-stat-card.green{border-left-color:#50d6a4}.t8-stat-card.yellow{border-left-color:#f4bd4e}.t8-stat-card.purple{border-left-color:#9290ff}
        .t8-stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .t8-stat-title{color:var(--muted);font-size:13px}
        .t8-stat-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:10px;background:#282c53;color:var(--purple)}
        .t8-stat-value{margin:15px 0 7px;overflow-wrap:anywhere;font-size:clamp(22px,2.2vw,29px);font-weight:800}
        .t8-stat-description{color:#8493c4;font-size:12px;line-height:1.5}
        .t8-panel{padding:23px;border:1px solid var(--border);border-radius:15px;background:var(--panel);min-width:0;margin-bottom:20px}
        .t8-panel h2,.t8-panel h3{margin:0 0 10px}
        .t8-panel p{color:var(--muted);line-height:1.7}
        .t8-action-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
        .t8-action-card{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px;border:1px solid var(--border);border-radius:14px;background:var(--panel)}
        .t8-action-card h3{margin:0;font-size:17px}.t8-action-card p{flex:1;margin:0 0 9px;color:var(--muted);font-size:13px;line-height:1.7}
        .t8-action-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#282c53;color:var(--purple);font-size:21px}
        .t8-notice{padding:14px 16px;border:1px solid #5a4720;border-radius:11px;margin-bottom:18px;background:#332b1a;color:#ffcf72;line-height:1.6}
        .t8-error{padding:16px;border:1px solid #713c4b;border-radius:12px;margin-bottom:18px;background:#351e30;color:#ffb8c6}
        .t8-loading{padding:32px;text-align:center;color:var(--muted);border:1px solid var(--border);border-radius:14px;background:var(--panel)}
        .t8-footer{margin-top:28px;padding:20px 0 5px;border-top:1px solid var(--border);color:#7f8bb5;font-size:12px;line-height:1.7}
        .t8-transaction-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:20px}
        .t8-transaction-metric{min-width:0;padding:17px;background:var(--panel);border:1px solid var(--border);border-radius:12px}
        .t8-transaction-metric span{display:block;color:var(--muted);font-size:12px;line-height:1.6}
        .t8-transaction-metric strong{display:block;margin-top:9px;font-size:22px;overflow-wrap:anywhere}
        .t8-transaction-filters{display:grid;grid-template-columns:minmax(220px,2fr) repeat(3,minmax(130px,1fr));gap:12px;margin-bottom:15px}
        .t8-transaction-filters input,.t8-transaction-filters select{width:100%;min-width:0;min-height:43px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:#10142b;color:var(--text);font:inherit;color-scheme:dark}
        .t8-transaction-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin-bottom:20px}
        .t8-transaction-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--border);border-radius:12px}
        .t8-transaction-table{width:100%;min-width:1050px;border-collapse:collapse;text-align:left}
        .t8-transaction-table th,.t8-transaction-table td{padding:14px;border-bottom:1px solid var(--border);vertical-align:top}
        .t8-transaction-table th{background:#11152c;color:#aab8e7;font-size:12px;white-space:nowrap}
        .t8-transaction-table td{font-size:13px;line-height:1.65;overflow-wrap:anywhere}
        .t8-transaction-table tbody tr:last-child td{border-bottom:0}.t8-transaction-table tbody tr:hover{background:#1b203e}
        .t8-transaction-primary{display:block;color:var(--text);font-weight:700}
        .t8-transaction-secondary{display:block;color:var(--muted);font-size:12px}
        .t8-transaction-id{display:block;max-width:190px;color:#b8c4ff;overflow-wrap:anywhere;font-family:Consolas,monospace;font-size:11px}
        .t8-payment-status{display:inline-block;padding:5px 9px;border-radius:20px;background:#292e4b;color:#dce2ff;font-size:11px;font-weight:800;white-space:nowrap}
        .t8-payment-status.captured{background:#143d35;color:#77e8bf}.t8-payment-status.failed{background:#462634;color:#ffb6c7}.t8-payment-status.pending{background:#47391f;color:#ffd681}
        .t8-transaction-empty{padding:34px 18px;color:var(--muted);text-align:center;line-height:1.7}
        .t8-transaction-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:18px}
        .t8-commission-search{width:100%;max-width:420px;padding:12px;margin-bottom:18px;border:1px solid var(--border);border-radius:9px;background:#10142b;color:var(--text);font:inherit}
        .t8-commission-rate{width:105px;padding:9px;border:1px solid var(--border);border-radius:8px;background:#10142b;color:var(--text)}
        @media(max-width:1200px){.t8-stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.t8-action-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:1000px){.t8-transaction-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.t8-transaction-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:850px){.t8-layout{grid-template-columns:1fr}.t8-sidebar{padding:12px;border-right:0;border-bottom:1px solid var(--border)}.t8-sidebar-label,.t8-sidebar-divider,.t8-sidebar-bottom{display:none}.t8-menu{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}.t8-menu-item{width:auto;flex:0 0 auto;white-space:nowrap;padding:11px 13px}.t8-main{padding:23px 18px}.t8-topbar{padding:12px 16px}}
        @media(max-width:560px){.t8-topbar{align-items:flex-start;flex-direction:column}.t8-brand{font-size:21px}.t8-prototype{font-size:10px}.t8-topbar-right{width:100%}.t8-role{flex:1;padding:9px 10px}.t8-stats-grid,.t8-action-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.t8-stat-card{padding:14px}.t8-stat-value{font-size:22px}.t8-stat-title{font-size:12px}.t8-stat-icon{width:29px;height:29px;font-size:15px}.t8-panel{padding:17px}.t8-heading-actions{width:100%}.t8-heading-actions .t8-button{flex:1}.t8-transaction-filters{grid-template-columns:1fr}.t8-transaction-summary{gap:9px}.t8-transaction-metric{padding:13px}.t8-transaction-metric strong{font-size:18px}}
        @media(max-width:360px){.t8-stats-grid,.t8-action-grid{grid-template-columns:1fr}}
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
          <button type="button" className="t8-role" onClick={() => navigate("/dashboard")}>Student</button>
          <button type="button" className="t8-role" onClick={() => navigate("/mentor-dashboard")}>Mentor</button>
          <button type="button" className="t8-role active" aria-current="page">Admin</button>
        </div>
      </header>

      <div className="t8-layout">
        <aside className="t8-sidebar">
          <p className="t8-sidebar-label">FINANCE &amp; OPERATIONS</p>
          <nav className="t8-menu" aria-label="Admin navigation">
            {financeMenu.map((item) => (
              <button
                type="button"
                key={item.section}
                className={`t8-menu-item ${activeSection === item.section ? "active" : ""}`}
                onClick={() => setActiveSection(item.section)}
                aria-current={activeSection === item.section ? "page" : undefined}
              >
                <span className="t8-menu-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="t8-sidebar-divider" />
          <p className="t8-sidebar-label">PLATFORM</p>
          <div className="t8-sidebar-bottom">
            <button type="button" onClick={() => navigate("/admin/mentors")}>♙ &nbsp; Mentor management</button>
            <button type="button" onClick={() => navigate("/admin/payouts")}>₹ &nbsp; Mentor payouts</button>
            <button type="button" onClick={() => navigate("/")}>↖ &nbsp; Back to website</button>
            <button type="button" onClick={handleLogout}>⇥ &nbsp; Logout</button>
          </div>
        </aside>

        <main className="t8-main">
          <div className="t8-page-heading">
            <div>
              <p className="t8-eyebrow">THRONE8 / ADMIN / FINANCE</p>
              <h1>{activeMenu?.label || "Admin Dashboard"}</h1>
              <p className="t8-subtitle">
                {activeSection === "overview"
                  ? `Welcome back, ${user?.name || "Admin"}. Here's your platform overview.`
                  : activeSection === "transactions"
                    ? "Review payment activity and transaction records."
                    : activeSection === "commission"
                      ? "Manage commission rates and review saved financial ledger records."
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
                onClick={() => {
                  if (activeSection === "transactions") fetchTransactions();
                  else if (activeSection === "commission") fetchCommissionMentors();
                  else fetchStats();
                }}
                disabled={loading || transactionLoading || commissionLoading}
              >
                {loading || transactionLoading || commissionLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
              <button type="button" className="t8-button primary" onClick={() => navigate("/admin/payouts")}>
                ₹ Manage payouts
              </button>
            </div>
          </div>

          {error && activeSection === "overview" && (
            <div className="t8-error" role="alert">
              <p>{error}</p>
              <button type="button" className="t8-button" onClick={fetchStats} disabled={loading}>Try again</button>
            </div>
          )}

          {activeSection === "overview" && (
            <>
              <div className="t8-notice">
                <strong>Finance workspace</strong> — platform statistics are loaded from your backend. Use payout management for payout records and approvals.
              </div>
              <h2 className="t8-section-title">Platform Overview</h2>
              <p className="t8-section-description">A live overview of users, mentorship bookings and payments.</p>

              {loading && !stats ? (
                <div className="t8-loading">Loading platform statistics...</div>
              ) : stats ? (
                <section className="t8-stats-grid">
                  {cards.map((card) => (
                    <article className={`t8-stat-card ${card.color}`} key={card.title}>
                      <div className="t8-stat-top">
                        <span className="t8-stat-title">{card.title}</span>
                        <span className="t8-stat-icon">{card.icon}</span>
                      </div>
                      <div className="t8-stat-value">
                        {typeof card.value === "string" ? card.value : formatNumber(card.value)}
                      </div>
                      <div className="t8-stat-description">{card.description}</div>
                    </article>
                  ))}
                </section>
              ) : !error ? (
                <div className="t8-loading">No dashboard statistics are available yet.</div>
              ) : null}

              <h2 className="t8-section-title">Quick Actions</h2>
              <p className="t8-section-description">Manage key parts of the THRONE8 mentorship platform.</p>
              <section className="t8-action-grid">
                <article className="t8-action-card">
                  <span className="t8-action-icon">♙</span>
                  <h3>Mentor Verification</h3>
                  <p>Review mentor profiles and verification requests.{stats ? ` ${formatNumber(stats.pendingMentorVerifications)} pending verification(s).` : ""}</p>
                  <button type="button" className="t8-button primary" onClick={() => navigate("/admin/mentors")}>Manage mentors →</button>
                </article>
                <article className="t8-action-card">
                  <span className="t8-action-icon">₹</span>
                  <h3>Mentor Payouts</h3>
                  <p>View payout history, generate eligible payouts and manage pending approvals.</p>
                  <button type="button" className="t8-button primary" onClick={() => navigate("/admin/payouts")}>Open payouts →</button>
                </article>
                <article className="t8-action-card">
                  <span className="t8-action-icon">▤</span>
                  <h3>Booking Activity</h3>
                  <p>Review booking totals and session completion statistics reported by your API.</p>
                  <div style={{ color: "#aab8e7", fontSize: 13 }}>Total bookings: {formatNumber(stats?.totalBookings)}</div>
                </article>
              </section>
            </>
          )}

          {activeSection === "transactions" && (
            <section>
              {transactionError && (
                <div className="t8-error" role="alert">
                  <p>{transactionError}</p>
                  <button type="button" className="t8-button" onClick={fetchTransactions} disabled={transactionLoading}>Try again</button>
                </div>
              )}

              <div className="t8-transaction-summary">
                <article className="t8-transaction-metric"><span>Total Transactions</span><strong>{formatNumber(transactionSummary.totalTransactions)}</strong></article>
                <article className="t8-transaction-metric"><span>Captured Payments</span><strong>{formatNumber(transactionSummary.capturedTransactions)}</strong><span>{formatRupees(transactionSummary.capturedAmountPaise)}</span></article>
                <article className="t8-transaction-metric"><span>Pending Payments</span><strong>{formatNumber(transactionSummary.pendingTransactions)}</strong></article>
                <article className="t8-transaction-metric"><span>Failed Payments</span><strong>{formatNumber(transactionSummary.failedTransactions)}</strong><span>{formatRupees(transactionSummary.failedAmountPaise)}</span></article>
              </div>

              <div className="t8-panel">
                <h2>Payment Transactions</h2>
                <p>Search payment records, review payment status and inspect linked booking details.</p>
                <form className="t8-transaction-filters" onSubmit={handleTransactionSearch}>
                  <input type="search" placeholder="Search student, mentor, order or payment ID" aria-label="Search transactions" value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} />
                  <select aria-label="Payment status" value={transactionStatus} onChange={(event) => { setTransactionStatus(event.target.value); setTransactionPage(1); }}>
                    <option value="">All payment statuses</option>
                    <option value="CREATED">Created</option>
                    <option value="AUTHORIZED">Authorized</option>
                    <option value="CAPTURED">Captured</option>
                    <option value="FAILED">Failed</option>
                    <option value="PARTIALLY_REFUNDED">Partially refunded</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                  <input type="date" aria-label="From date" value={transactionFrom} onChange={(event) => { setTransactionFrom(event.target.value); setTransactionPage(1); }} />
                  <input type="date" aria-label="To date" value={transactionTo} onChange={(event) => { setTransactionTo(event.target.value); setTransactionPage(1); }} />
                  <button type="submit" className="t8-button primary">Search</button>
                  <button type="button" className="t8-button" onClick={resetTransactionFilters}>Clear filters</button>
                </form>

                <div className="t8-transaction-actions">
                  <span className="t8-transaction-secondary">{transactionLoading ? "Loading transactions..." : `${formatNumber(transactionPagination.total)} transaction(s) found`}</span>
                  <button type="button" className="t8-button" onClick={fetchTransactions} disabled={transactionLoading}>{transactionLoading ? "Refreshing..." : "↻ Refresh"}</button>
                </div>

                {transactionLoading && transactions.length === 0 ? (
                  <div className="t8-loading">Loading payment records...</div>
                ) : transactionError && transactions.length === 0 ? (
                  <div className="t8-transaction-empty">Transactions could not be loaded. Please retry.</div>
                ) : transactions.length === 0 ? (
                  <div className="t8-transaction-empty"><strong>No transactions found.</strong><br />Try changing the search text, status or date filters.</div>
                ) : (
                  <div className="t8-transaction-table-wrap">
                    <table className="t8-transaction-table">
                      <thead><tr><th>Transaction</th><th>Student</th><th>Mentor</th><th>Amount</th><th>Payment Status</th><th>Booking Status</th><th>Payment Date</th><th>Refunded</th></tr></thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <tr key={transaction._id}>
                            <td>
                              <span className="t8-transaction-primary">{transaction.gateway || "Razorpay"}</span>
                              <span className="t8-transaction-secondary">Order ID</span>
                              <span className="t8-transaction-id">{transaction.gatewayOrderId || "—"}</span>
                              <span className="t8-transaction-secondary">Payment ID</span>
                              <span className="t8-transaction-id">{transaction.gatewayPaymentId || "Not paid"}</span>
                              <span className="t8-transaction-secondary">Booking ID</span>
                              <span className="t8-transaction-id">{transaction.bookingId || "—"}</span>
                            </td>
                            <td><span className="t8-transaction-primary">{transaction.student?.name || "Unknown"}</span><span className="t8-transaction-secondary">{transaction.student?.email || "—"}</span></td>
                            <td><span className="t8-transaction-primary">{transaction.mentor?.name || "Unknown"}</span><span className="t8-transaction-secondary">{transaction.mentor?.email || "—"}</span><span className="t8-transaction-secondary">{(transaction.mentor?.expertise || []).join(", ")}</span></td>
                            <td><span className="t8-transaction-primary">{formatRupees(transaction.amountPaise)}</span><span className="t8-transaction-secondary">{transaction.currency || "INR"}</span></td>
                            <td><span className={`t8-payment-status ${statusClass(transaction.status)}`}>{(transaction.status || "UNKNOWN").replaceAll("_", " ")}</span></td>
                            <td><span className="t8-transaction-primary">{(transaction.bookingStatus || "UNKNOWN").replaceAll("_", " ")}</span><span className="t8-transaction-secondary">Start: {formatDateTime(transaction.slotStart)}</span><span className="t8-transaction-secondary">End: {formatDateTime(transaction.slotEnd)}</span></td>
                            <td><span className="t8-transaction-primary">{formatDateTime(transaction.capturedAt || transaction.createdAt)}</span><span className="t8-transaction-secondary">{transaction.capturedAt ? "Captured at" : "Order created at"}</span></td>
                            <td><span className="t8-transaction-primary">{formatRupees(transaction.refundedAmountPaise)}</span>{(transaction.refunds || []).map((refund, index) => <span key={refund.gatewayRefundId || index} className="t8-transaction-secondary">{refund.status}: {formatRupees(refund.amountPaise)}</span>)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="t8-transaction-pagination">
                  <span className="t8-transaction-secondary">Page {transactionPagination.page || 1} of {transactionPagination.totalPages || 1}</span>
                  <div className="t8-heading-actions">
                    <button type="button" className="t8-button" disabled={transactionLoading || transactionPage <= 1} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}>← Previous</button>
                    <button type="button" className="t8-button" disabled={transactionLoading || transactionPage >= (transactionPagination.totalPages || 1)} onClick={() => setTransactionPage((page) => page + 1)}>Next →</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === "commission" && (
            <section>
              {commissionError && (
                <div className="t8-error" role="alert">
                  <p>{commissionError}</p>
                  <button type="button" className="t8-button" onClick={fetchCommissionMentors} disabled={commissionLoading}>Try again</button>
                </div>
              )}
              {commissionMessage && <div className="t8-notice" role="status">{commissionMessage}</div>}

              <div className="t8-panel">
                <div className="t8-page-heading">
                  <div><h2>Commission Overview</h2><p>Financial totals come from saved FinancialLedger records.</p></div>
                  <button type="button" className="t8-button" onClick={fetchCommissionMentors} disabled={commissionLoading}>{commissionLoading ? "Refreshing..." : "↻ Refresh"}</button>
                </div>

                {commissionOverview ? (
                  <>
                    <div className="t8-transaction-summary">
                      <article className="t8-transaction-metric"><span>Total Mentors</span><strong>{formatNumber(commissionOverview.totalMentors)}</strong><span>Verified: {formatNumber(commissionOverview.verifiedMentors)}</span></article>
                      <article className="t8-transaction-metric"><span>Average Commission Rate</span><strong>{Number(commissionOverview.averageCommissionPercentage || 0).toFixed(2)}%</strong></article>
                      <article className="t8-transaction-metric"><span>Platform Commission</span><strong>{formatRupees(commissionOverview.totalPlatformCommissionPaise)}</strong></article>
                      <article className="t8-transaction-metric"><span>Mentor Earnings</span><strong>{formatRupees(commissionOverview.totalMentorEarningsPaise)}</strong><span>{formatNumber(commissionOverview.confirmedLedgerCount)} ledger record(s)</span></article>
                    </div>
                    <p className="t8-section-description">Total student payments: <strong>{formatRupees(commissionOverview.totalStudentPaidPaise)}</strong></p>
                    <p className="t8-transaction-secondary">These totals reflect the backend's CONFIRMED ledger aggregation.</p>
                  </>
                ) : !commissionLoading ? (
                  <div className="t8-transaction-empty">Commission overview is not available.</div>
                ) : <div className="t8-loading">Loading commission overview...</div>}
              </div>

              <div className="t8-panel">
                <h2>Mentor Commission Rates</h2>
                <p>Change the rate for future bookings. Existing financial ledger records keep their saved rate.</p>
                <input className="t8-commission-search" type="search" placeholder="Search mentor name or email" aria-label="Search mentors" value={commissionSearch} onChange={(event) => setCommissionSearch(event.target.value)} />

                {commissionLoading && commissionMentors.length === 0 ? (
                  <div className="t8-loading">Loading mentor rates...</div>
                ) : (
                  <div className="t8-transaction-table-wrap">
                    <table className="t8-transaction-table">
                      <thead><tr><th>Mentor</th><th>Session Price</th><th>Current Rate</th><th>New Rate (%)</th><th>Estimated Commission</th><th>Estimated Earnings</th><th>Action</th></tr></thead>
                      <tbody>
                        {filteredCommissionMentors.map((mentor) => {
                          const price = Number(mentor.sessionPricePaise || 0);
                          const currentBps = Number(mentor.commissionRateBps ?? 2000);
                          const rawValue = commissionEdits[mentor._id] ?? "";
                          const percentage = Number(rawValue);
                          const valid = rawValue !== "" && Number.isFinite(percentage) && percentage >= 0 && percentage <= 100;
                          const commissionPaise = valid ? Math.round(price * percentage / 100) : 0;

                          return (
                            <tr key={mentor._id}>
                              <td><span className="t8-transaction-primary">{mentor.userId?.name || mentor.name || "Unknown mentor"}</span><span className="t8-transaction-secondary">{mentor.userId?.email || mentor.email || "—"}</span></td>
                              <td>{formatRupees(price)}</td>
                              <td>{(currentBps / 100).toFixed(2)}%</td>
                              <td><input className="t8-commission-rate" type="number" min="0" max="100" step="0.01" value={rawValue} aria-label={`Commission rate for ${mentor.userId?.name || mentor.name || "mentor"}`} onChange={(event) => setCommissionEdits((previous) => ({ ...previous, [mentor._id]: event.target.value }))} /></td>
                              <td>{formatRupees(commissionPaise)}</td>
                              <td>{formatRupees(price - commissionPaise)}</td>
                              <td><button type="button" className="t8-button primary" disabled={!valid || savingCommissionId === mentor._id || Math.round(percentage * 100) === currentBps} onClick={() => saveCommission(mentor)}>{savingCommissionId === mentor._id ? "Saving..." : "Save rate"}</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!commissionLoading && filteredCommissionMentors.length === 0 && <div className="t8-transaction-empty">No matching mentors found.</div>}
                  </div>
                )}
                <div className="t8-footer">The estimates in this table use the mentor's current session price and edited rate. Historical amounts below use saved ledger values.</div>
              </div>

              <div className="t8-panel">
                <h2>Commission Transactions</h2>
                <p>Booking-level historical rates, payments, platform commission and mentor earnings.</p>

                <div className="t8-transaction-actions">
                  <span className="t8-transaction-secondary">{formatNumber(commissionRecordsPagination.total)} ledger record(s) found</span>
                </div>

                {commissionLoading && commissionRecords.length === 0 ? (
                  <div className="t8-loading">Loading ledger records...</div>
                ) : commissionRecords.length === 0 ? (
                  <div className="t8-transaction-empty">No commission ledger records found.</div>
                ) : (
                  <div className="t8-transaction-table-wrap">
                    <table className="t8-transaction-table">
                      <thead><tr><th>Booking ID</th><th>Mentor</th><th>Booking Status</th><th>Saved Rate</th><th>Student Paid</th><th>Platform Commission</th><th>Mentor Earnings</th><th>Completed At</th><th>Ledger Status</th></tr></thead>
                      <tbody>
                        {commissionRecords.map((record) => (
                          <tr key={record.ledgerId || record.bookingId}>
                            <td><span className="t8-transaction-id">{record.bookingId || "—"}</span><span className="t8-transaction-secondary">Ledger: {record.ledgerId || "—"}</span></td>
                            <td><span className="t8-transaction-primary">{record.mentor?.name || "Unknown mentor"}</span><span className="t8-transaction-secondary">{record.mentor?.email || "—"}</span></td>
                            <td>{(record.bookingStatus || "UNKNOWN").replaceAll("_", " ")}</td>
                            <td>{Number(record.commissionPercentage ?? Number(record.commissionRateBps || 0) / 100).toFixed(2)}%</td>
                            <td>{formatRupees(record.studentPaidPaise)}</td>
                            <td>{formatRupees(record.platformCommissionPaise)}</td>
                            <td>{formatRupees(record.mentorEarningsPaise)}</td>
                            <td>{formatDateTime(record.completedAt)}</td>
                            <td><span className="t8-payment-status">{(record.ledgerStatus || "UNKNOWN").replaceAll("_", " ")}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="t8-transaction-pagination">
                  <span className="t8-transaction-secondary">Page {commissionRecordsPagination.page || 1} of {commissionRecordsPagination.totalPages || 1}</span>
                  <div className="t8-heading-actions">
                    <button type="button" className="t8-button" disabled={commissionLoading || commissionRecordsPage <= 1} onClick={() => setCommissionRecordsPage((page) => Math.max(1, page - 1))}>← Previous</button>
                    <button type="button" className="t8-button" disabled={commissionLoading || commissionRecordsPage >= (commissionRecordsPagination.totalPages || 1)} onClick={() => setCommissionRecordsPage((page) => page + 1)}>Next →</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection !== "overview" &&
            activeSection !== "transactions" &&
            activeSection !== "commission" && (
              <section className="t8-panel">
                <h2>{activeMenu?.label}</h2>
                <p>
                  {activeSection === "earnings" && "Use Mentor Payouts to review eligible earnings and payout approvals."}
                  {activeSection === "refunds" && "Refund requests and disputes need their corresponding backend endpoints before they can be displayed or updated here."}
                  {activeSection === "failed" && "Open Mentor Payouts to review available payout records. Failed-payout filtering requires the corresponding records and status data."}
                  {activeSection === "reconciliation" && "Provider-versus-ledger reconciliation needs a backend reconciliation endpoint and recorded discrepancy data."}
                  {activeSection === "audit" && "The audit log needs its connected backend endpoint to display real actors, timestamps and recorded changes."}
                </p>
                {(activeSection === "earnings" || activeSection === "failed") && <button type="button" className="t8-button primary" onClick={() => navigate("/admin/payouts")}>Open Mentor Payouts →</button>}
                <div className="t8-footer">This section requires its corresponding backend integration to display and manage real records.</div>
              </section>
            )}

          <footer className="t8-footer">
            <strong>THRONE8</strong> · Mentorship Admin Portal<br />
            Signed in as {user?.name || "Admin"} · Finance data is provided by your connected API.
          </footer>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;

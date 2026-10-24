
import { useCallback, useEffect, useMemo, useState } from "react";

// const API = "http://localhost:8080/api/v1";
const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api/v1";

const money = (paise = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);

const getId = (item) => item?._id || item?.id || "";

const emptySummary = {
  completedSessions: 0,
  totalCompletedEarningsPaise: 0,
  pendingEligibilityPaise: 0,
  eligibleUnpaidPaise: 0,
  payoutPendingPaise: 0,
  payoutApprovedPaise: 0,
  payoutProcessingPaise: 0,
  totalPaidPaise: 0,
  payoutFailedPaise: 0,
  payoutCancelledPaise: 0,
};

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusClass = (status) =>
  String(status || "UNKNOWN").toLowerCase().replace(/[^a-z0-9-]/g, "-");

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const token = localStorage.getItem("throne8_token");

  // const request = async (path, options = {}) => {
    const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

  //   return data;
  // };
      return data;
  }, [token]);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [payoutData, financeData] = await Promise.all([
        request("/admin/payouts"),
        request("/admin/finance-summary"),
      ]);

      const list = Array.isArray(payoutData.payouts)
        ? payoutData.payouts
        : Array.isArray(payoutData.data)
          ? payoutData.data
          : [];

      setPayouts(list);

      setSummary({
        ...emptySummary,
        ...(financeData.summary || {}),
      });
    } catch (err) {
      setError(err.message || "Unable to load finance data.");
    } finally {
      setLoading(false);
    }
  // }, [token]);
    }, [request]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const generatePayouts = async () => {
    if (
      !window.confirm(
        "Generate payout records for all currently eligible sessions?"
      )
    ) {
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/admin/payouts/generate", {
        method: "POST",
      });

      setMessage(
        data.message || "Eligible payout generation request completed."
      );

      await loadPayouts();
    } catch (err) {
      setError(err.message || "Could not generate payouts.");
    } finally {
      setGenerating(false);
    }
  };

  const approvePayout = async (payoutId) => {
    if (!window.confirm("Approve this payout for processing?")) return;

    setBusyId(payoutId);
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/admin/payouts/${payoutId}/approve`,
        { method: "PATCH" }
      );

      console.log("PAYOUT APPROVAL RESPONSE:", data);

      setMessage(data.message || "Payout approved successfully.");

      await loadPayouts();
    } catch (err) {
      setError(err.message || "Could not approve payout.");
    } finally {
      setBusyId("");
    }
  };

  const totalRecordedPaise = payouts.reduce(
    (sum, payout) => sum + Number(payout.amountPaise || 0),
    0
  );

  const statusCounts = useMemo(() => {
    const counts = {};

    payouts.forEach((payout) => {
      const status = String(payout.status || "UNKNOWN").toUpperCase();
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return payouts.filter((payout) => {
      const status = String(payout.status || "UNKNOWN").toUpperCase();

      const bookingId =
        typeof payout.bookingId === "object"
          ? getId(payout.bookingId)
          : payout.bookingId || "";

      const mentor =
        payout.mentorId?.name ||
        payout.mentor?.name ||
        payout.mentorName ||
        "";

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      const matchesSearch =
        !term ||
        [
          getId(payout),
          bookingId,
          mentor,
          status,
          payout.razorpayPayoutId,
        ].some((value) => String(value || "").toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [payouts, search, statusFilter]);

  const financeCards = [
    {
      label: "Completed Earnings",
      value: money(summary.totalCompletedEarningsPaise),
      detail: `${summary.completedSessions} completed session(s)`,
      icon: "◈",
      color: "purple",
    },
    {
      label: "Pending Eligibility",
      value: money(summary.pendingEligibilityPaise),
      detail: "Waiting for the 15-day period",
      icon: "◷",
      color: "orange",
    },
    {
      label: "Eligible Unpaid",
      value: money(summary.eligibleUnpaidPaise),
      detail: "Eligible but not yet paid",
      icon: "◉",
      color: "blue",
    },
    {
      label: "Pending Approval",
      value: money(summary.payoutPendingPaise),
      detail: "Awaiting admin approval",
      icon: "◌",
      color: "yellow",
    },
    {
      label: "Approved",
      value: money(summary.payoutApprovedPaise),
      detail: "Approved for processing",
      icon: "✓",
      color: "green",
    },
    {
      label: "Processing",
      value: money(summary.payoutProcessingPaise),
      detail: "Payout being processed",
      icon: "↻",
      color: "blue",
    },
    {
      label: "Total Paid",
      value: money(summary.totalPaidPaise),
      detail: "Recorded as paid",
      icon: "₹",
      color: "green",
    },
    {
      label: "Failed Payouts",
      value: money(summary.payoutFailedPaise),
      detail: "Failed payout records",
      icon: "!",
      color: "red",
    },
  ];

  const managementCards = [
    {
      label: "Total Records",
      value: payouts.length,
      icon: "▤",
    },
    {
      label: "Total Recorded",
      value: money(totalRecordedPaise),
      icon: "₹",
    },
    {
      label: "Pending",
      value: statusCounts.PENDING || 0,
      icon: "◷",
    },
    {
      label: "Paid",
      value: statusCounts.PAID || 0,
      icon: "✓",
    },
  ];

  return (
    <main className="admin-payouts">
      <style>{`
        .admin-payouts {
          --bg: #0b0b16;
          --panel: #121224;
          --panel-light: #18182d;
          --border: #292744;
          --purple: #a78bfa;
          --purple-bright: #8b5cf6;
          --text: #f5f3ff;
          --muted: #a5a3bd;

          min-height: 100vh;
          padding: 34px;
          background:
            radial-gradient(ellipse at 85% 0%, rgba(109, 40, 217, .13), transparent 36%),
            var(--bg);
          color: var(--text);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-sizing: border-box;
        }

        .admin-payouts *,
        .admin-payouts *::before,
        .admin-payouts *::after {
          box-sizing: border-box;
        }

        .payout-container {
          max-width: 1500px;
          margin: 0 auto;
        }

        .payout-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }

        .payout-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 12px;
          color: var(--purple);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .payout-eyebrow::before {
          content: "";
          width: 22px;
          height: 2px;
          background: var(--purple-bright);
          border-radius: 10px;
        }

        .payout-heading h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 38px);
          letter-spacing: -1.2px;
          line-height: 1.2;
        }

        .payout-description {
          margin: 12px 0 0;
          max-width: 650px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .payout-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .payout-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          padding: 11px 16px;
          border: 1px solid #383353;
          border-radius: 10px;
          background: #19182c;
          color: #eeeaff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background .2s, border-color .2s, transform .2s;
        }

        .payout-button:hover:not(:disabled) {
          background: #272140;
          border-color: var(--purple);
          transform: translateY(-1px);
        }

        .payout-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .payout-button-primary {
          background: linear-gradient(135deg, #8b5cf6, #6d3be8);
          border-color: transparent;
          color: white;
          box-shadow: 0 5px 18px rgba(124, 58, 237, .2);
        }

        .payout-button-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #9b72fa, #7948f0);
          border-color: transparent;
        }

        .payout-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          margin-bottom: 18px;
          border: 1px solid;
          border-radius: 11px;
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .payout-error {
          background: rgba(239, 68, 68, .09);
          border-color: rgba(248, 113, 113, .3);
          color: #fca5a5;
        }

        .payout-success {
          background: rgba(34, 197, 94, .08);
          border-color: rgba(74, 222, 128, .28);
          color: #86efac;
        }

        .payout-section {
          margin-top: 34px;
        }

        .payout-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 17px;
        }

        .payout-section-heading h2 {
          margin: 0;
          font-size: 19px;
          font-weight: 750;
          letter-spacing: -.35px;
        }

        .payout-section-subtitle {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .payout-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
        }

        .payout-card {
          position: relative;
          min-width: 0;
          padding: 20px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: linear-gradient(145deg, rgba(25, 24, 47, .98), rgba(17, 17, 34, .98));
          transition: transform .2s, border-color .2s;
        }

        .payout-card:hover {
          transform: translateY(-2px);
          border-color: #514079;
        }

        .payout-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .payout-card-label {
          color: #c2bfd9;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.5;
        }

        .payout-card-icon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 35px;
          height: 35px;
          border: 1px solid rgba(167, 139, 250, .22);
          border-radius: 10px;
          background: rgba(139, 92, 246, .12);
          color: #c4b5fd;
          font-size: 19px;
          font-weight: 800;
        }

        .payout-card-value {
          display: block;
          margin: 19px 0 9px;
          color: #fff;
          font-size: clamp(20px, 2vw, 27px);
          font-weight: 800;
          letter-spacing: -.7px;
          overflow-wrap: anywhere;
        }

        .payout-card-detail {
          display: block;
          min-height: 18px;
          color: #9290ac;
          font-size: 11px;
          line-height: 1.6;
        }

        .payout-card-purple .payout-card-icon {
          color: #c4b5fd;
          background: rgba(139, 92, 246, .15);
        }

        .payout-card-orange .payout-card-icon {
          color: #fdba74;
          background: rgba(249, 115, 22, .12);
        }

        .payout-card-blue .payout-card-icon {
          color: #93c5fd;
          background: rgba(59, 130, 246, .12);
        }

        .payout-card-yellow .payout-card-icon {
          color: #fde68a;
          background: rgba(234, 179, 8, .1);
        }

        .payout-card-green .payout-card-icon {
          color: #86efac;
          background: rgba(34, 197, 94, .1);
        }

        .payout-card-red .payout-card-icon {
          color: #fca5a5;
          background: rgba(239, 68, 68, .1);
        }

        .payout-management-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--panel);
        }

        .payout-management-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: rgba(139, 92, 246, .14);
          color: #c4b5fd;
          font-size: 22px;
        }

        .payout-management-label {
          display: block;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .payout-management-value {
          display: block;
          margin-top: 6px;
          font-size: 23px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .payout-table-wrap {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 15px;
          background: rgba(18, 18, 36, .96);
        }

        .payout-table-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          padding: 19px 20px;
          border-bottom: 1px solid var(--border);
        }

        .payout-table-toolbar h2 {
          margin: 0;
          font-size: 17px;
        }

        .payout-record-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 27px;
          height: 25px;
          padding: 0 8px;
          margin-left: 7px;
          border-radius: 7px;
          background: rgba(139, 92, 246, .15);
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 800;
        }

        .payout-filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .payout-search,
        .payout-select {
          min-height: 40px;
          padding: 10px 12px;
          border: 1px solid #34314f;
          border-radius: 9px;
          outline: none;
          background: #0e0e1d;
          color: #f5f3ff;
          font: inherit;
          font-size: 12px;
        }

        .payout-search {
          width: min(260px, 100%);
        }

        .payout-search::placeholder {
          color: #77758f;
        }

        .payout-search:focus,
        .payout-select:focus {
          border-color: var(--purple-bright);
          box-shadow: 0 0 0 3px rgba(139, 92, 246, .1);
        }

        .payout-select {
          min-width: 145px;
          cursor: pointer;
        }

        .payout-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .payout-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .payout-table th {
          padding: 15px 17px;
          background: rgba(25, 24, 47, .75);
          color: #a8a5c2;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .payout-table td {
          padding: 17px;
          border-bottom: 1px solid rgba(41, 39, 68, .8);
          color: #e5e2f5;
          font-size: 12px;
          vertical-align: middle;
        }

        .payout-table tbody tr {
          transition: background .15s;
        }

        .payout-table tbody tr:hover {
          background: rgba(139, 92, 246, .055);
        }

        .payout-table tbody tr:last-child td {
          border-bottom: none;
        }

        .payout-id {
          max-width: 175px;
          color: #c4b5fd !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px !important;
          overflow-wrap: anywhere;
        }

        .payout-amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .payout-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border: 1px solid;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .3px;
          white-space: nowrap;
        }

        .payout-status::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .payout-status-pending {
          border-color: rgba(251, 191, 36, .22);
          background: rgba(251, 191, 36, .08);
          color: #fcd34d;
        }

        .payout-status-approved {
          border-color: rgba(96, 165, 250, .22);
          background: rgba(96, 165, 250, .08);
          color: #93c5fd;
        }

        .payout-status-processing {
          border-color: rgba(167, 139, 250, .25);
          background: rgba(139, 92, 246, .1);
          color: #c4b5fd;
        }

        .payout-status-paid {
          border-color: rgba(74, 222, 128, .22);
          background: rgba(34, 197, 94, .08);
          color: #86efac;
        }

        .payout-status-failed,
        .payout-status-cancelled,
        .payout-status-rejected {
          border-color: rgba(248, 113, 113, .22);
          background: rgba(239, 68, 68, .08);
          color: #fca5a5;
        }

        .payout-status-unknown {
          border-color: #41405b;
          background: #24233b;
          color: #c4c1d9;
        }

        .payout-approve-button {
          min-height: 34px;
          padding: 8px 12px;
          border: 1px solid rgba(167, 139, 250, .32);
          border-radius: 8px;
          background: rgba(139, 92, 246, .13);
          color: #d8ccff;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: background .2s;
        }

        .payout-approve-button:hover:not(:disabled) {
          background: rgba(139, 92, 246, .28);
        }

        .payout-approve-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .payout-empty {
          padding: 55px 20px;
          text-align: center;
        }

        .payout-empty-icon {
          display: grid;
          place-items: center;
          width: 55px;
          height: 55px;
          margin: 0 auto 15px;
          border: 1px solid #353052;
          border-radius: 16px;
          background: #1a1830;
          color: #c4b5fd;
          font-size: 25px;
        }

        .payout-empty h3 {
          margin: 0 0 8px;
          font-size: 15px;
        }

        .payout-empty p {
          max-width: 400px;
          margin: 0 auto;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.8;
        }

        .payout-loading {
          padding: 35px 20px;
          color: var(--muted);
          font-size: 13px;
          text-align: center;
        }

        .payout-footnote {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 20px;
          padding: 16px;
          border: 1px solid #292744;
          border-radius: 12px;
          background: rgba(18, 18, 36, .7);
          color: #aaa7c3;
          font-size: 11px;
          line-height: 1.8;
        }

        .payout-footnote-icon {
          flex-shrink: 0;
          color: #c4b5fd;
          font-size: 17px;
        }

        .payout-footnote strong {
          color: #e4ddff;
        }

        .payout-footer {
          padding: 24px 0 5px;
          color: #6f6d89;
          font-size: 11px;
          text-align: center;
        }

        @media (max-width: 1100px) {
          .payout-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .admin-payouts {
            padding: 22px 14px;
          }

          .payout-heading {
            align-items: flex-start;
          }

          .payout-actions {
            width: 100%;
          }

          .payout-actions .payout-button {
            flex: 1;
          }

          .payout-stats {
            grid-template-columns: 1fr;
            gap: 11px;
          }

          .payout-card {
            padding: 17px;
          }

          .payout-card-value {
            margin-top: 13px;
          }

          .payout-management-card {
            padding: 15px;
          }

          .payout-table-toolbar {
            align-items: flex-start;
            padding: 16px;
          }

          .payout-filters {
            width: 100%;
          }

          .payout-search {
            width: 100%;
            flex: 1 1 100%;
          }

          .payout-select {
            width: 100%;
          }

          .payout-table th,
          .payout-table td {
            padding: 13px;
          }
        }
      `}</style>

      <div className="payout-container">
        <header className="payout-heading">
          <div>
            <p className="payout-eyebrow">THRONE8 / FINANCE</p>
            <h1>Mentor Payouts</h1>
            <p className="payout-description">
              Monitor mentor earnings, payout eligibility and payout history.
              Manage payout approvals from one place.
            </p>
          </div>

          <div className="payout-actions">
            <button
              type="button"
              className="payout-button"
              onClick={loadPayouts}
              disabled={loading}
            >
              ↻ {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="payout-button payout-button-primary"
              onClick={generatePayouts}
              disabled={generating || loading}
            >
              {generating ? "Generating..." : "+ Generate Payouts"}
            </button>
          </div>
        </header>

        {error && (
          <div className="payout-notice payout-error" role="alert">
            <span>!</span>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="payout-notice payout-success" role="status">
            <span>✓</span>
            <span>{message}</span>
          </div>
        )}

        <section className="payout-section">
          <div className="payout-section-heading">
            <div>
              <h2>Finance Summary</h2>
              <p className="payout-section-subtitle">
                Overview of mentor earnings and payout status.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="payout-loading">
              Loading finance summary...
            </div>
          ) : (
            <div className="payout-stats">
              {financeCards.map((card) => (
                <article
                  className={`payout-card payout-card-${card.color}`}
                  key={card.label}
                >
                  <div className="payout-card-top">
                    <span className="payout-card-label">
                      {card.label}
                    </span>
                    <span className="payout-card-icon">
                      {card.icon}
                    </span>
                  </div>

                  <strong className="payout-card-value">
                    {card.value}
                  </strong>

                  <small className="payout-card-detail">
                    {card.detail}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="payout-section">
          <div className="payout-section-heading">
            <div>
              <h2>Payout Management</h2>
              <p className="payout-section-subtitle">
                Track payout records and payment totals.
              </p>
            </div>
          </div>

          <div className="payout-stats">
            {managementCards.map((card) => (
              <article className="payout-management-card" key={card.label}>
                <div className="payout-management-icon">
                  {card.icon}
                </div>

                <div>
                  <span className="payout-management-label">
                    {card.label}
                  </span>
                  <strong className="payout-management-value">
                    {card.value}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="payout-section">
          <div className="payout-section-heading">
            <div>
              <h2>Payout History</h2>
              <p className="payout-section-subtitle">
                Search records, filter statuses and approve pending payouts.
              </p>
            </div>
          </div>

          <div className="payout-table-wrap">
            <div className="payout-table-toolbar">
              <h2>
                Payout Records
                <span className="payout-record-count">
                  {filteredPayouts.length}
                </span>
              </h2>

              <div className="payout-filters">
                <input
                  type="search"
                  className="payout-search"
                  placeholder="Search payout, booking or mentor..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search payout records"
                />

                <select
                  className="payout-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter payouts by status"
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="payout-loading">
                Loading payout records...
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="payout-empty">
                <div className="payout-empty-icon">▤</div>
                <h3>
                  {payouts.length === 0
                    ? "No payout records yet"
                    : "No matching payouts"}
                </h3>
                <p>
                  {payouts.length === 0
                    ? "Payout records will appear here when eligible sessions have been processed."
                    : "Try another search term or select a different status filter."}
                </p>
              </div>
            ) : (
              <div className="payout-table-scroll">
                <table className="payout-table">
                  <thead>
                    <tr>
                      <th>Payout ID</th>
                      <th>Booking ID</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayouts.map((payout, index) => {
                      const id = getId(payout);

                      const bookingId =
                        typeof payout.bookingId === "object"
                          ? getId(payout.bookingId)
                          : payout.bookingId;

                      const status = String(
                        payout.status || "UNKNOWN"
                      ).toUpperCase();

                      const statusClass = getStatusClass(status);

                      return (
                        <tr key={id || `payout-${index}`}>
                          <td className="payout-id">
                            {id || "—"}
                          </td>

                          <td className="payout-id">
                            {bookingId || "—"}
                          </td>

                          <td className="payout-amount">
                            {money(payout.amountPaise)}
                          </td>

                          <td>
                            <span
                              className={`payout-status payout-status-${statusClass}`}
                            >
                              {status}
                            </span>
                          </td>

                          <td>{formatDate(payout.createdAt)}</td>

                          <td>
                            {status === "PENDING" && id ? (
                              <button
                                type="button"
                                className="payout-approve-button"
                                disabled={busyId === id}
                                onClick={() => approvePayout(id)}
                              >
                                {busyId === id
                                  ? "Approving..."
                                  : "✓ Approve"}
                              </button>
                            ) : (
                              <span style={{ color: "#77758f" }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="payout-footnote">
          <span className="payout-footnote-icon">ⓘ</span>
          <div>
            <strong>Important payout information</strong>
            <br />
            Payout eligibility begins 15 calendar days after session
            completion, according to your backend eligibility rules.
            Approval alone does not transfer money. Actual Razorpay payout
            processing and provider confirmation are separate steps.
          </div>
        </div>

        <footer className="payout-footer">
          THRONE8 Finance Dashboard · Mentor Payout Management
        </footer>
      </div>
    </main>
  );
}
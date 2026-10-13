
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:8080/api/v1";

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

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("throne8_token");

  const request = async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  };

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
  }, [token]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const generatePayouts = async () => {
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

  const financeCards = [
    {
      label: "Total Completed Earnings",
      value: money(summary.totalCompletedEarningsPaise),
      detail: `${summary.completedSessions} completed session(s)`,
    },
    {
      label: "Pending Eligibility",
      value: money(summary.pendingEligibilityPaise),
      detail: "Waiting for the 15-day period",
    },
    {
      label: "Eligible Unpaid",
      value: money(summary.eligibleUnpaidPaise),
      detail: "Eligible but not yet paid",
    },
    {
      label: "Pending Approval",
      value: money(summary.payoutPendingPaise),
      detail: "Payout awaiting admin approval",
    },
    {
      label: "Approved",
      value: money(summary.payoutApprovedPaise),
      detail: "Approved for processing",
    },
    {
      label: "Processing",
      value: money(summary.payoutProcessingPaise),
      detail: "Payout processing status",
    },
    {
      label: "Total Paid",
      value: money(summary.totalPaidPaise),
      detail: "Recorded as paid",
    },
    {
      label: "Failed Payouts",
      value: money(summary.payoutFailedPaise),
      detail: "Failed payout records",
    },
  ];

  return (
    <main className="admin-payouts">
      <style>{`
        .admin-payouts {
          min-height: 100vh;
          background: #111210;
          color: #f4f4ef;
          padding: 32px;
          font-family: Arial, sans-serif;
        }

        .payout-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }

        .payout-heading h1 {
          margin: 0 0 8px;
        }

        .payout-muted {
          color: #a3a59c;
        }

        .payout-section-title {
          margin: 28px 0 16px;
          font-size: 21px;
        }

        .payout-stats {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(190px, 1fr)
          );
          gap: 16px;
          margin-bottom: 24px;
        }

        .payout-card,
        .payout-table-wrap {
          background: #1b1c19;
          border: 1px solid #34352f;
          border-radius: 12px;
          padding: 20px;
        }

        .payout-card strong {
          display: block;
          font-size: 24px;
          margin: 12px 0 8px;
          overflow-wrap: anywhere;
        }

        .payout-card small {
          color: #a3a59c;
          line-height: 1.5;
        }

        .payout-button {
          border: 1px solid #77796e;
          border-radius: 8px;
          background: #e5e6d8;
          color: #171812;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .payout-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .payout-notice {
          padding: 12px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          overflow-wrap: anywhere;
        }

        .payout-error {
          background: #442321;
          color: #ffd8d4;
        }

        .payout-success {
          background: #203b2a;
          color: #d1f5d9;
        }

        .payout-table-wrap {
          overflow-x: auto;
        }

        .payout-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        .payout-table th,
        .payout-table td {
          text-align: left;
          padding: 14px 12px;
          border-bottom: 1px solid #34352f;
          vertical-align: middle;
        }

        .payout-table th {
          color: #bfc1b5;
          font-size: 13px;
        }

        .payout-id {
          max-width: 180px;
          overflow-wrap: anywhere;
        }

        .payout-status {
          font-weight: 700;
        }

        @media (max-width: 600px) {
          .admin-payouts {
            padding: 18px;
          }

          .payout-card strong {
            font-size: 21px;
          }
        }
      `}</style>

      <div className="payout-heading">
        <div>
          <p className="payout-muted">THRONE8 / FINANCE</p>
          <h1>Mentor Payouts</h1>
          <p className="payout-muted">
            Monitor mentor earnings, payout eligibility and payout history.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="payout-button"
            onClick={loadPayouts}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="payout-button"
            onClick={generatePayouts}
            disabled={generating || loading}
          >
            {generating ? "Generating..." : "Generate Eligible Payouts"}
          </button>
        </div>
      </div>

      {error && (
        <div className="payout-notice payout-error">{error}</div>
      )}

      {message && (
        <div className="payout-notice payout-success">{message}</div>
      )}

      <h2 className="payout-section-title">Finance Summary</h2>

      {loading ? (
        <p className="payout-muted">Loading finance summary...</p>
      ) : (
        <section className="payout-stats">
          {financeCards.map((card) => (
            <div className="payout-card" key={card.label}>
              <span className="payout-muted">{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </section>
      )}

      <h2 className="payout-section-title">Payout Management</h2>

      <section className="payout-stats">
        <div className="payout-card">
          <span className="payout-muted">Payout Records</span>
          <strong>{payouts.length}</strong>
        </div>

        <div className="payout-card">
          <span className="payout-muted">Total Recorded Amount</span>
          <strong>{money(totalRecordedPaise)}</strong>
        </div>

        <div className="payout-card">
          <span className="payout-muted">Pending Records</span>
          <strong>
            {payouts.filter((p) => p.status === "PENDING").length}
          </strong>
        </div>

        <div className="payout-card">
          <span className="payout-muted">Paid Records</span>
          <strong>
            {payouts.filter((p) => p.status === "PAID").length}
          </strong>
        </div>
      </section>

      <section className="payout-table-wrap">
        <h2>Payout History</h2>

        {loading ? (
          <p className="payout-muted">Loading payout records...</p>
        ) : payouts.length === 0 ? (
          <p className="payout-muted">
            No payout records found. Payouts can be generated when
            sessions become eligible.
          </p>
        ) : (
          <table className="payout-table">
            <thead>
              <tr>
                <th>Payout ID</th>
                <th>Booking ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {payouts.map((payout) => {
                const id = getId(payout);
                const bookingId =
                  typeof payout.bookingId === "object"
                    ? getId(payout.bookingId)
                    : payout.bookingId;

                return (
                  <tr key={id}>
                    <td className="payout-id">{id || "—"}</td>
                    <td className="payout-id">{bookingId || "—"}</td>
                    <td>{money(payout.amountPaise)}</td>
                    <td className="payout-status">
                      {payout.status || "UNKNOWN"}
                    </td>
                    <td>
                      {payout.createdAt
                        ? new Date(
                            payout.createdAt
                          ).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td>
                      {payout.status === "PENDING" && id ? (
                        <button
                          className="payout-button"
                          disabled={busyId === id}
                          onClick={() => approvePayout(id)}
                        >
                          {busyId === id ? "Approving..." : "Approve"}
                        </button>
                      ) : (
                        <span className="payout-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="payout-muted" style={{ marginTop: 18 }}>
        Payout eligibility begins 15 calendar days after session completion.
        Approval alone does not transfer money. Actual Razorpay payout
        processing and provider confirmation are separate steps.
      </p>
    </main>
  );
}

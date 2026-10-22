
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

const NAV = [
  { id: "overview", label: "Earnings overview" },
  { id: "ledger", label: "Earnings ledger" },
  { id: "payouts", label: "Payout history" },
  { id: "statements", label: "Statements" },
];

const css = `
*{box-sizing:border-box}
.md{min-height:100vh;background:#0e1024;color:#f4f4ff;font-family:Inter,system-ui,sans-serif}
.md button{font:inherit}
.md-header{height:76px;background:#171b36;border-bottom:1px solid #303654;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;gap:20px}
.md-brand{display:flex;align-items:center;gap:12px;color:#fff;text-decoration:none;font-size:24px;font-weight:850}
.md-logo{width:39px;height:39px;display:grid;place-items:center;border-radius:11px;background:#8987ff;font-size:14px}
.md-role{display:flex;gap:5px;background:#0e1127;padding:5px;border-radius:13px}
.md-role a{padding:10px 16px;color:#aeb9e2;text-decoration:none;border-radius:9px;font-size:14px}
.md-role a.active{background:#202443;color:white;border:1px solid #393f68}
.md-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:calc(100vh - 76px)}
.md-sidebar{background:#0e1127;border-right:1px solid #303654;padding:24px 16px}
.md-side-title{font-size:11px;text-transform:uppercase;letter-spacing:1.6px;color:#777fa8;padding:0 12px 14px}
.md-side-link{display:block;width:100%;padding:14px 15px;border:0;border-radius:10px;background:transparent;color:#aeb9e2;text-align:left;text-decoration:none;font-size:14px;margin-bottom:5px;cursor:pointer}
.md-side-link:hover{background:#171c39;color:white}
.md-side-link.active{background:#252b50;color:#9c9aff;font-weight:750}
.md-side-bottom{margin-top:28px;border-top:1px solid #292f4b;padding-top:18px}
.md-content{min-width:0;padding:36px 35px 55px;max-width:1600px;width:100%;margin:0 auto}
.md-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:24px}
.md-heading h1{font-size:30px;letter-spacing:-.7px;margin:0 0 9px}
.md-heading p{color:#91a4d6;margin:0;font-size:15px;line-height:1.7}
.md-btn{border:1px solid #4a4e7a;background:transparent;color:#dedcff;border-radius:10px;padding:11px 15px;cursor:pointer;font-size:12px;font-weight:750}
.md-btn:hover{background:#202443}
.md-btn:disabled{opacity:.55;cursor:not-allowed}
.md-alert{padding:15px 18px;border-radius:12px;margin-bottom:20px;background:#382d12;color:#ffbd35;font-size:14px;line-height:1.7}
.md-error,.md-success{padding:13px 16px;border-radius:10px;margin-bottom:18px;font-size:13px}
.md-error{background:#3a1c2a;color:#ffb7c4;border:1px solid #673044}
.md-success{background:#123328;color:#9af0c4;border:1px solid #245b45}
.md-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}
.md-card{background:#171b36;border:1px solid #303654;border-left:5px solid #9690ff;border-radius:15px;padding:22px 20px;min-width:0}
.md-card:nth-child(2){border-left-color:#a0a3c5}
.md-card:nth-child(3){border-left-color:#e5a800}
.md-card:nth-child(4){border-left-color:#2874dc}
.md-card:nth-child(5){border-left-color:#8746e8}
.md-card:nth-child(6){border-left-color:#087f5b}
.md-card:nth-child(7){border-left-color:#c52b35}
.md-card-label{font-size:13px;color:#9bb0e2;margin-bottom:10px}
.md-card-value{font-size:28px;font-weight:850;overflow-wrap:anywhere}
.md-card-note{font-size:12px;color:#9aa7d0;margin-top:9px;line-height:1.6}
.md-panel{background:#171b36;border:1px solid #303654;border-radius:16px;margin-bottom:20px;overflow:hidden}
.md-panel-body{padding:24px}
.md-panel h2{font-size:20px;margin:0 0 20px}
.md-bar{height:13px;border-radius:20px;overflow:hidden;display:flex;background:#282e4d}
.md-bar-segment{height:100%}
.md-legend{display:flex;flex-wrap:wrap;gap:15px;margin-top:17px;color:#aab7df;font-size:12px}
.md-legend span{display:flex;align-items:center;gap:7px}
.md-dot{width:10px;height:10px;border-radius:3px;display:inline-block}
.md-next{background:#171b36;border:1px solid #45406d;border-radius:15px;padding:23px;margin-bottom:20px}
.md-next h2{font-size:18px;margin:0 0 10px}
.md-next p,.md-note{color:#aab7df;font-size:13px;line-height:1.8;margin:0}
.md-table-wrap{overflow-x:auto;padding:10px 20px 20px}
.md-table{border-collapse:collapse;width:100%;min-width:980px;text-align:left;font-size:13px}
.md-table th,.md-table td{padding:16px 12px;border-bottom:1px solid #303654;white-space:nowrap}
.md-table th{color:#9bb0e2;font-weight:650}
.md-table td{color:#eef0ff}
.md-table tr:last-child td{border-bottom:0}
.md-status{display:inline-block;padding:6px 10px;border-radius:20px;font-size:11px;font-weight:800;text-transform:uppercase;background:#292e4a;color:#c4cbe7}
.md-status.paid,.md-status.succeeded,.md-status.completed{background:#123c31;color:#55e5ad}
.md-status.eligible{background:#142e53;color:#66adff}
.md-status.holding,.md-status.on_hold,.md-status.processing,.md-status.pending{background:#443517;color:#ffc24c}
.md-status.refunded,.md-status.failed,.md-status.disputed,.md-status.review_required{background:#49212b;color:#ff9da9}
.md-empty{padding:42px 20px;text-align:center;color:#a0acce;font-size:13px;line-height:1.8}
.md-footnote{padding:0 24px 22px;color:#9aa7d0;font-size:12px;line-height:1.8}
.md-booking{border-top:1px solid #303654;padding:18px 0;display:flex;justify-content:space-between;align-items:center;gap:16px}
.md-booking:first-child{border-top:0}
.md-booking strong{display:block;margin-bottom:7px;font-size:14px}
.md-booking small{color:#9aa7d0;line-height:1.8}
.md-footer{padding:24px;text-align:center;border-top:1px solid #242a46;color:#777fa8;font-size:12px;line-height:1.8}
@media(max-width:1100px){.md-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.md-content{padding:28px 22px}}
@media(max-width:700px){.md-header{padding:13px 16px}.md-brand{font-size:20px}.md-role a{padding:9px;font-size:12px}.md-shell{grid-template-columns:1fr}.md-sidebar{border-right:0;border-bottom:1px solid #303654;padding:12px;display:flex;gap:7px;overflow-x:auto}.md-side-title,.md-side-bottom{display:none}.md-side-link{white-space:nowrap;width:auto;flex-shrink:0;margin:0;padding:12px;font-size:12px}.md-content{padding:24px 14px}.md-heading h1{font-size:25px}.md-cards{gap:9px}.md-card{padding:15px 12px}.md-card-value{font-size:22px}.md-card-note{font-size:11px}.md-panel-body{padding:17px}}
`;

const listFrom = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  for (const key of ["bookings", "payouts", "payoutHistory", "history", "ledger", "records", "items", "entries"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const statusOf = (item) =>
  String(item?.status || item?.bookingStatus || item?.paymentStatus || "pending").toLowerCase();

const rupees = (paise) => Number(paise || 0) / 100;

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const amountPaise = (item, ...keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
};

const dateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const dateTimeText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const bookingIdOf = (booking) => booking?._id || booking?.id || booking?.bookingId;

const studentNameOf = (record) => {
  const student = record?.student || record?.user || record?.booking?.student;
  if (typeof student === "string") return record?.studentName || student;
  return student?.name || student?.fullName || record?.studentName || "Student";
};

const feeOf = (record) => amountPaise(
  record, "sessionFeePaise", "pricePaise", "amountPaise", "grossAmountPaise", "totalAmountPaise"
);

const commissionOf = (record) => amountPaise(record, "commissionPaise");

const netOf = (record) => amountPaise(
  record, "mentorGrossPaise", "mentorEarningsPaise", "netAmountPaise", "mentorAmountPaise"
);

const payableAtOf = (record) =>
  record?.payoutEligibleAt || record?.eligibleAt || record?.payableFrom || record?.payoutEligibleDate;

function downloadStatement(month, statement) {
  const rows = [
    ["Month", "Sessions", "Gross", "Commission", "Net earned", "Paid out"],
    [month, statement.sessions, statement.gross, statement.commission, statement.net, statement.paid],
  ];
  const csv = rows.map((row) => row.map((cell) =>
    `"${String(cell).replaceAll('"', '""')}"`
  ).join(",")).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `THRONE8-statement-${month}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MentorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [section, setSection] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [completingId, setCompletingId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const errors = [];

    try {
      const response = await api.get("/mentors/my-bookings");
      setBookings(listFrom(response));
    } catch (err) {
      errors.push(err?.response?.data?.message || "Bookings load nahi ho paayin.");
    }

    try {
      const response = await api.get("/mentors/earnings");
      const data = response?.data;
      const payload = data?.earnings ?? data?.data ?? data ?? null;
      setEarnings(payload);

      const payoutList = [
        data?.payouts, data?.payoutHistory, data?.history,
        payload?.payouts, payload?.payoutHistory, payload?.history,
      ].find(Array.isArray);
      setPayouts(payoutList || []);
    } catch (err) {
      errors.push(err?.response?.data?.message || "Earnings load nahi ho paayin.");
      setEarnings(null);
      setPayouts([]);
    }

    if (errors.length) setError(errors.join(" "));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = earnings?.summary || earnings || {};

  const totalEarned = rupees(amountPaise(summary,
    "totalCompletedEarningsPaise", "totalEarningsPaise", "totalEarnedPaise", "mentorEarningsPaise"));

  const pending = rupees(amountPaise(summary,
    "pendingSessionEarningsPaise", "pendingEarningsPaise"));

  const hold = rupees(amountPaise(summary,
    "pendingEligibilityPaise", "fifteenDayHoldPaise", "waitingPeriodPaise"));

  const eligible = rupees(amountPaise(summary,
    "eligibleUnpaidEarningsPaise", "eligibleEarningsPaise"));

  const processing = rupees(amountPaise(summary,
    "processingPayoutsPaise", "processingPaise"));

  const paid = rupees(amountPaise(summary,
    "paidPayoutsPaise", "totalPaidPaise"));

  const onHold = rupees(amountPaise(summary,
    "onHoldEarningsPaise", "disputedEarningsPaise"));

  const ledger = useMemo(() => {
    for (const value of [
      earnings?.ledger, earnings?.records, earnings?.items, earnings?.entries,
      earnings?.ledgers, earnings?.summary?.ledger, earnings?.summary?.records,
    ]) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }, [earnings]);

  const allocation = [
    { label: "Pending session", amount: pending, color: "#9ca3c7" },
    { label: "15-day hold", amount: hold, color: "#e5a800" },
    { label: "Eligible", amount: eligible, color: "#2563eb" },
    { label: "Processing", amount: processing, color: "#8245df" },
    { label: "Paid out", amount: paid, color: "#087f5b" },
    { label: "On hold", amount: onHold, color: "#c52b25" },
  ];

  const allocationTotal = allocation.reduce((sum, item) => sum + item.amount, 0);

  const nextPayoutDate =
    summary.nextPayoutDate || summary.nextPayoutAt || summary.nextPayout?.date;

  const nextPayoutAmount = rupees(amountPaise(summary,
    "nextPayoutAmountPaise") || amountPaise(summary.nextPayout, "amountPaise"));

  const statements = useMemo(() => {
    const groups = new Map();

    for (const record of ledger) {
      const value = record?.sessionDate || record?.completedAt ||
        record?.booking?.slotStart || record?.bookingId?.slotStart || record?.createdAt;
      if (!value) continue;

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(key)) {
        groups.set(key, { sessions: 0, gross: 0, commission: 0, net: 0, paid: 0 });
      }

      const group = groups.get(key);
      const gross = rupees(feeOf(record));
      const commission = rupees(commissionOf(record));
      const net = rupees(netOf(record));

      group.sessions += 1;
      group.gross += gross;
      group.commission += commission;
      group.net += net;

      if (["paid", "succeeded"].includes(statusOf(record))) group.paid += net;
    }

    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, values]) => ({ month, ...values }));
  }, [ledger]);

  const completeBooking = async (booking) => {
    const id = bookingIdOf(booking);
    if (!id) {
      setError("Booking ID nahi mili.");
      return;
    }

    const endValue = booking?.slotEnd || booking?.sessionEndTime;
    if (!endValue || Number.isNaN(new Date(endValue).getTime())) {
      setError("Session end time nahi mila. Completion API se pehle booking details verify karein.");
      return;
    }

    if (new Date() < new Date(endValue)) {
      setError("Session end hone ke baad hi complete mark kar sakte hain.");
      return;
    }

    setCompletingId(String(id));
    setError("");
    setSuccess("");

    try {
      await api.patch(`/bookings/${id}/complete`);
      setSuccess("Session completion request successful.");
      await loadDashboard();
    } catch (err) {
      setError(err?.response?.data?.message || "Session complete nahi hua.");
    } finally {
      setCompletingId("");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch {
      setError("Logout nahi ho paya. Dobara try karein.");
    }
  };

  const title = NAV.find((item) => item.id === section)?.label || "Earnings overview";

  const stats = [
    ["Total earned", totalEarned, "All sessions, after commission"],
    ["Pending session", pending, "Session not held yet"],
    ["15-day hold", hold, "Waiting for the eligibility period"],
    ["Eligible", eligible, "Eligible unpaid balance"],
    ["Processing", processing, "Transfer in progress"],
    ["Paid out", paid, "Provider-confirmed payouts"],
    ["On hold", onHold, "Refund or dispute under review"],
  ];

  return (
    <div className="md">
      <style>{css}</style>

      <header className="md-header">
        <Link className="md-brand" to="/">
          <span className="md-logo">T8</span>
          <span>Throne8</span>
        </Link>
        <nav className="md-role">
          <Link to="/">Student</Link>
          <Link to="/mentor-dashboard" className="active">Mentor</Link>
          <Link to="/admin-dashboard">Admin</Link>
        </nav>
      </header>

      <div className="md-shell">
        <aside className="md-sidebar">
          <div className="md-side-title">Mentor finance</div>

          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`md-side-link ${section === item.id ? "active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}

          <div className="md-side-bottom">
            <Link to="/mentor-dashboard" className="md-side-link">Sessions dashboard</Link>
            <Link to="/" className="md-side-link">Back to website</Link>
            <button className="md-side-link" onClick={handleLogout}>Logout ↗</button>
          </div>
        </aside>

        <main className="md-content">
          <div className="md-heading">
            <div>
              <h1>{title}</h1>
              <p>
                {section === "overview" && "Your earnings after THRONE8 commission, organized by payout stage."}
                {section === "ledger" && "Every session, with the date its earnings become payable."}
                {section === "payouts" && "Transfers to your verified bank account."}
                {section === "statements" && "Monthly summaries for your records and accountant."}
              </p>
            </div>
            <button className="md-btn" onClick={loadDashboard} disabled={loading}>
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          {error && <div className="md-error">{error}</div>}
          {success && <div className="md-success">{success}</div>}

          {section !== "overview" && section !== "sessions" && (
            <div className="md-alert">
              Pending amounts are <strong>not cash yet.</strong> Only a provider-confirmed payout counts as transferred to your bank account.
            </div>
          )}

          {section === "overview" && (
            <>
              <div className="md-alert">
                Pending amounts are <strong>not cash yet.</strong> Only “Paid out” has been transferred after provider confirmation.
              </div>

              <div className="md-cards">
                {stats.map(([label, value, note]) => (
                  <div className="md-card" key={label}>
                    <div className="md-card-label">{label}</div>
                    <div className="md-card-value">{loading ? "—" : money(value)}</div>
                    <div className="md-card-note">{note}</div>
                  </div>
                ))}
              </div>

              <section className="md-panel">
                <div className="md-panel-body">
                  <h2>Where your money is</h2>
                  <div className="md-bar" aria-label="Earnings allocation">
                    {allocation.map((item) => (
                      <div
                        key={item.label}
                        className="md-bar-segment"
                        title={`${item.label}: ${money(item.amount)}`}
                        style={{
                          width: allocationTotal > 0 ? `${item.amount / allocationTotal * 100}%` : "0%",
                          background: item.color,
                        }}
                      />
                    ))}
                  </div>
                  <div className="md-legend">
                    {allocation.map((item) => (
                      <span key={item.label}>
                        <i className="md-dot" style={{ background: item.color }} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="md-next">
                <h2>Next payout</h2>
                {nextPayoutDate ? (
                  <p>
                    Next payout date: {dateTimeText(nextPayoutDate)}.
                    {nextPayoutAmount > 0 ? ` Reported amount: ${money(nextPayoutAmount)}.` : ""}
                    Eligibility and transfer still depend on the verified payout record.
                  </p>
                ) : eligible > 0 ? (
                  <p>{money(eligible)} is reported as eligible unpaid balance. A payout date has not been provided by the API.</p>
                ) : (
                  <p>No payout is currently marked eligible. Eligibility requires verified session completion, the 15-day waiting period and cleared refund or dispute holds.</p>
                )}
              </section>

              <div className="md-footnote">
                Figures are based on the current earnings API response. Missing dates, transfer IDs and payout records are not invented.
              </div>

              <section className="md-panel">
                <div className="md-panel-body">
                  <h2>Session completion</h2>
                  {loading ? <div className="md-empty">Loading bookings...</div> :
                    bookings.length === 0 ? <div className="md-empty">No booking records were returned by the API.</div> :
                    bookings.map((booking, index) => {
                      const status = statusOf(booking);
                      const id = bookingIdOf(booking);
                      const canComplete = status === "confirmed" &&
                        Boolean(booking?.slotEnd || booking?.sessionEndTime) &&
                        new Date() >= new Date(booking.slotEnd || booking.sessionEndTime);

                      return (
                        <div className="md-booking" key={id || index}>
                          <div>
                            <strong>{studentNameOf(booking)}</strong>
                            <small>
                              Booking: {id || "—"}<br />
                              Session: {dateText(booking?.slotStart || booking?.sessionDate || booking?.date)}<br />
                              Amount: {money(rupees(amountPaise(booking, "pricePaise", "amountPaise")))}
                            </small>
                          </div>
                          {["completed", "complete"].includes(status) ? (
                            <span className="md-status completed">Completed</span>
                          ) : (
                            <button
                              className="md-btn"
                              disabled={!canComplete || completingId === String(id)}
                              onClick={() => completeBooking(booking)}
                            >
                              {completingId === String(id) ? "Saving..." : "Mark complete"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            </>
          )}

          {section === "ledger" && (
            <section className="md-panel">
              {loading ? <div className="md-empty">Loading earnings ledger...</div> :
                ledger.length === 0 ? (
                  <div className="md-empty">No earnings ledger records were returned by the earnings API.</div>
                ) : (
                  <div className="md-table-wrap">
                    <table className="md-table">
                      <thead>
                        <tr>
                          <th>Booking</th><th>Student</th><th>Session date</th>
                          <th>Payable from</th><th>Session fee</th><th>Commission</th>
                          <th>You earn</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((record, index) => {
                          const booking = record?.booking && typeof record.booking === "object"
                            ? record.booking
                            : record?.bookingId && typeof record.bookingId === "object"
                              ? record.bookingId : {};
                          const id = booking?._id || booking?.id ||
                            (typeof record?.bookingId === "string" ? record.bookingId : "—");
                          const status = statusOf(record);
                          const fee = rupees(feeOf(record));
                          const commission = rupees(commissionOf(record));
                          const net = rupees(netOf(record));

                          return (
                            <tr key={record?._id || id || index}>
                              <td>{String(id)}</td>
                              <td>{record?.studentName || booking?.studentName || studentNameOf(record)}</td>
                              <td>{dateText(record?.sessionDate || record?.completedAt || booking?.slotStart)}</td>
                              <td>{dateText(payableAtOf(record))}</td>
                              <td>{money(fee)}</td>
                              <td>{money(commission)}</td>
                              <td><strong>{money(net)}</strong></td>
                              <td><span className={`md-status ${status.replaceAll(" ", "_")}`}>{status.replaceAll("_", " ")}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              <div className="md-footnote">
                Payable date is based on verified session completion plus 15 calendar days. Refunds and disputes can pause payout eligibility.
              </div>
            </section>
          )}

          {section === "payouts" && (
            <section className="md-panel">
              {loading ? <div className="md-empty">Loading payout history...</div> :
                payouts.length === 0 ? (
                  <div className="md-empty">No payout history records are available from the API yet.</div>
                ) : (
                  <div className="md-table-wrap">
                    <table className="md-table">
                      <thead>
                        <tr>
                          <th>Payout</th><th>Sessions</th><th>Started</th>
                          <th>Confirmed</th><th>Transfer ID</th><th>Amount</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map((payout, index) => {
                          const status = statusOf(payout);
                          const confirmedAt = payout?.confirmedAt || payout?.paidAt ||
                            payout?.providerConfirmedAt;
                          const succeeded = Boolean(confirmedAt) &&
                            ["paid", "succeeded"].includes(status);
                          const amount = payout?.amountPaise != null
                            ? rupees(payout.amountPaise)
                            : Number(payout?.amount || 0);

                          return (
                            <tr key={payout?._id || payout?.id || index}>
                              <td>{payout?.reference || payout?.payoutNumber || payout?._id || "—"}</td>
                              <td>{Array.isArray(payout?.bookingIds) ? payout.bookingIds.length : payout?.sessionCount ?? "—"}</td>
                              <td>{dateText(payout?.startedAt || payout?.createdAt || payout?.initiatedAt)}</td>
                              <td>{succeeded ? dateText(confirmedAt) : "—"}</td>
                              <td>{payout?.transferId || payout?.gatewayTransferId || payout?.providerTransferId || "—"}</td>
                              <td>{money(amount)}</td>
                              <td><span className={`md-status ${succeeded ? "succeeded" : status.replaceAll(" ", "_")}`}>{succeeded ? "Succeeded" : status.replaceAll("_", " ")}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              <div className="md-footnote">
                “Succeeded” is shown only when the payout record includes a confirmation date and a successful status.
              </div>
            </section>
          )}

          {section === "statements" && (
            <section className="md-panel">
              {loading ? <div className="md-empty">Loading statements...</div> :
                statements.length === 0 ? (
                  <div className="md-empty">Monthly statements need dated ledger records from the earnings API.</div>
                ) : (
                  <div className="md-table-wrap">
                    <table className="md-table">
                      <thead>
                        <tr>
                          <th>Month</th><th>Sessions</th><th>Gross</th>
                          <th>Commission</th><th>Net earned</th><th>Paid out</th><th>Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statements.map((statement) => {
                          const [year, month] = statement.month.split("-");
                          const label = new Date(Number(year), Number(month) - 1, 1)
                            .toLocaleDateString("en-IN", { month: "short", year: "numeric" });

                          return (
                            <tr key={statement.month}>
                              <td>{label}</td>
                              <td>{statement.sessions}</td>
                              <td>{money(statement.gross)}</td>
                              <td>{money(statement.commission)}</td>
                              <td>{money(statement.net)}</td>
                              <td>{money(statement.paid)}</td>
                              <td>
                                <button
                                  className="md-btn"
                                  onClick={() => downloadStatement(statement.month, statement)}
                                >
                                  Download CSV
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              <div className="md-footnote">
                Downloads are CSV summaries calculated from the API ledger, not official tax documents or PDF statements.
              </div>
            </section>
          )}
        </main>
      </div>

      <footer className="md-footer">
        <strong>THRONE8</strong>
        <div>Empowering your journey through mentorship.</div>
        © {new Date().getFullYear()} THRONE8. All rights reserved.
      </footer>
    </div>
  );
}





















































// import { useCallback, useEffect, useMemo, useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/useAuth";
// import api from "../services/api";

// const styles = `
//   * { box-sizing: border-box; }

//   .mentor-page {
//     min-height: 100vh;
//     background: #080b16;
//     color: #f4f4ff;
//     font-family: Inter, system-ui, sans-serif;
//   }

//   .mentor-nav {
//     min-height: 76px;
//     padding: 18px 7%;
//     display: flex;
//     justify-content: space-between;
//     align-items: center;
//     gap: 18px;
//     flex-wrap: wrap;
//     background: rgba(13, 17, 34, .96);
//     border-bottom: 1px solid rgba(167, 139, 250, .17);
//   }

//   .mentor-brand {
//     color: #c4b5fd;
//     font-size: 25px;
//     font-weight: 900;
//     letter-spacing: 2px;
//     text-decoration: none;
//   }

//   .mentor-nav-links {
//     display: flex;
//     align-items: center;
//     gap: 20px;
//     flex-wrap: wrap;
//   }

//   .mentor-nav-links a {
//     color: #c6c8dc;
//     text-decoration: none;
//     font-size: 14px;
//   }

//   .mentor-nav-links a:hover { color: #c4b5fd; }

//   .mentor-logout, .mentor-refresh {
//     border: 1px solid rgba(196, 181, 253, .4);
//     background: transparent;
//     color: #ddd6fe;
//     padding: 10px 16px;
//     border-radius: 10px;
//     cursor: pointer;
//     font-weight: 700;
//     font-size: 13px;
//   }

//   .mentor-logout:hover, .mentor-refresh:hover {
//     background: rgba(139, 92, 246, .16);
//   }

//   .mentor-main {
//     max-width: 1240px;
//     margin: auto;
//     padding: 42px 24px 65px;
//   }

//   .mentor-hero {
//     position: relative;
//     overflow: hidden;
//     padding: 40px;
//     border-radius: 24px;
//     background: linear-gradient(120deg, #17152f, #242052 55%, #30205d);
//     border: 1px solid rgba(196, 181, 253, .2);
//     margin-bottom: 28px;
//   }

//   .mentor-hero::after {
//     content: "";
//     position: absolute;
//     width: 240px;
//     height: 240px;
//     right: -80px;
//     top: -110px;
//     border-radius: 50%;
//     background: rgba(167, 139, 250, .16);
//     pointer-events: none;
//   }

//   .mentor-eyebrow {
//     color: #c4b5fd;
//     font-size: 12px;
//     font-weight: 800;
//     letter-spacing: 2px;
//     text-transform: uppercase;
//   }

//   .mentor-hero h1 {
//     font-size: clamp(29px, 4vw, 43px);
//     margin: 14px 0 12px;
//     letter-spacing: -1px;
//     overflow-wrap: anywhere;
//   }

//   .mentor-hero p {
//     max-width: 660px;
//     color: #c6c4df;
//     line-height: 1.8;
//     margin: 0;
//     font-size: 14px;
//   }

//   .mentor-section-heading {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 16px;
//     flex-wrap: wrap;
//     margin: 35px 0 20px;
//   }

//   .mentor-section-heading h2 {
//     font-size: 21px;
//     margin: 0 0 7px;
//   }

//   .mentor-section-heading p {
//     color: #969bb8;
//     font-size: 13px;
//     margin: 0;
//     line-height: 1.7;
//   }

//    .mentor-stats {
//     display: grid;
//     grid-template-columns: repeat(3, minmax(0, 1fr));
//     gap: 17px;
//     margin-bottom: 35px;
//   }

//   .mentor-stat {
//     background: linear-gradient(145deg, #12182b, #101426);
//     border: 1px solid #262c48;
//     padding: 22px;
//     border-radius: 18px;
//     min-width: 0;
//   }

//   .mentor-stat-label {
//     color: #a3a8c2;
//     font-size: 13px;
//     margin-bottom: 14px;
//   }

//   .mentor-stat-value {
//     color: #f4f4ff;
//     font-size: clamp(23px, 3vw, 31px);
//     font-weight: 800;
//     overflow-wrap: anywhere;
//   }

//   .mentor-stat-note {
//     margin-top: 9px;
//     color: #969bb8;
//     font-size: 12px;
//   }

//   .mentor-panel {
//     background: linear-gradient(145deg, #12182b, #101426);
//     border: 1px solid #262c48;
//     border-radius: 20px;
//     overflow: hidden;
//     margin-bottom: 26px;
//   }

//   .mentor-panel-head {
//     padding: 22px 24px;
//     display: flex;
//     justify-content: space-between;
//     align-items: center;
//     gap: 14px;
//     flex-wrap: wrap;
//     border-bottom: 1px solid #262c48;
//   }

//   .mentor-panel-head h3 {
//     margin: 0 0 6px;
//     font-size: 17px;
//   }

//   .mentor-panel-head p {
//     color: #969bb8;
//     margin: 0;
//     font-size: 12px;
//   }

//   .mentor-filters {
//     padding: 18px 24px;
//     display: flex;
//     gap: 9px;
//     flex-wrap: wrap;
//     border-bottom: 1px solid #262c48;
//   }

//   .mentor-filter {
//     border: 1px solid #343a58;
//     background: #11162a;
//     color: #aeb3ce;
//     border-radius: 9px;
//     padding: 9px 13px;
//     cursor: pointer;
//     font-size: 12px;
//     font-weight: 700;
//   }

//   .mentor-filter.active {
//     background: rgba(139, 92, 246, .2);
//     color: #ddd6fe;
//     border-color: #8b5cf6;
//   }

//   .mentor-bookings {
//     display: grid;
//     grid-template-columns: repeat(2, minmax(0, 1fr));
//     gap: 16px;
//     padding: 22px;
//   }

//   .mentor-booking {
//     border: 1px solid #292f4b;
//     border-radius: 15px;
//     padding: 20px;
//     background: rgba(8, 11, 22, .45);
//     min-width: 0;
//   }

//   .mentor-booking-top {
//     display: flex;
//     align-items: flex-start;
//     justify-content: space-between;
//     gap: 12px;
//     margin-bottom: 17px;
//   }

//   .mentor-booking h4 {
//     margin: 0 0 6px;
//     font-size: 16px;
//     overflow-wrap: anywhere;
//   }

//   .mentor-booking-sub {
//     color: #969bb8;
//     font-size: 12px;
//     overflow-wrap: anywhere;
//   }

//   .mentor-status {
//     display: inline-block;
//     border: 1px solid #343a58;
//     color: #c6c8dc;
//     background: #171d32;
//     border-radius: 20px;
//     padding: 6px 9px;
//     font-size: 10px;
//     font-weight: 800;
//     white-space: nowrap;
//     text-transform: capitalize;
//   }

//   .mentor-status.completed {
//     color: #86efac;
//     background: rgba(34, 197, 94, .1);
//     border-color: rgba(34, 197, 94, .3);
//   }

//   .mentor-status.confirmed, .mentor-status.approved {
//     color: #c4b5fd;
//     background: rgba(139, 92, 246, .13);
//     border-color: rgba(139, 92, 246, .3);
//   }

//   .mentor-status.cancelled, .mentor-status.rejected {
//     color: #fca5a5;
//     background: rgba(239, 68, 68, .1);
//     border-color: rgba(239, 68, 68, .3);
//   }

//   .mentor-booking-details {
//     display: grid;
//     gap: 12px;
//     margin-bottom: 18px;
//   }

//   .mentor-detail-row {
//     display: flex;
//     justify-content: space-between;
//     gap: 15px;
//     font-size: 12px;
//   }

//   .mentor-detail-row span:first-child { color: #969bb8; }

//   .mentor-detail-row span:last-child {
//     text-align: right;
//     color: #e2e4f5;
//     overflow-wrap: anywhere;
//   }

//   .mentor-complete-btn {
//     width: 100%;
//     border: 0;
//     border-radius: 10px;
//     padding: 12px;
//     background: linear-gradient(100deg, #7c3aed, #6d5ce8);
//     color: white;
//     font-weight: 800;
//     font-size: 12px;
//     cursor: pointer;
//   }

//   .mentor-complete-btn:hover { filter: brightness(1.12); }

//   .mentor-complete-btn:disabled {
//     opacity: .5;
//     cursor: not-allowed;
//   }

//   .mentor-empty {
//     padding: 42px 20px;
//     text-align: center;
//     color: #969bb8;
//     line-height: 1.8;
//     grid-column: 1 / -1;
//     font-size: 13px;
//   }

//   .mentor-error {
//     padding: 13px 16px;
//     border-radius: 12px;
//     margin-bottom: 18px;
//     border: 1px solid rgba(248, 113, 113, .3);
//     color: #fca5a5;
//     background: rgba(127, 29, 29, .15);
//     font-size: 13px;
//   }

//   .mentor-success {
//     padding: 13px 16px;
//     border-radius: 12px;
//     margin-bottom: 18px;
//     border: 1px solid rgba(74, 222, 128, .3);
//     color: #86efac;
//     background: rgba(20, 83, 45, .15);
//     font-size: 13px;
//   }

//     .mentor-earnings-tabs {
//     display: flex;
//     gap: 10px;
//     flex-wrap: wrap;
//     padding: 18px 24px;
//     border-bottom: 1px solid #262c48;
//   }

//   .mentor-earnings-tab {
//     border: 1px solid #343a58;
//     background: #11162a;
//     color: #aeb3ce;
//     border-radius: 9px;
//     padding: 10px 14px;
//     cursor: pointer;
//     font-size: 12px;
//     font-weight: 700;
//   }

//   .mentor-earnings-tab.active {
//     background: rgba(139, 92, 246, .2);
//     color: #ddd6fe;
//     border-color: #8b5cf6;
//   }

  
//   .mentor-ledger-wrap {
//     padding: 20px 24px;
//   }

//   .mentor-ledger-table {
//     width: 100%;
//     border-collapse: collapse;
//     color: #e5e7eb;
//     font-size: 12px;
//     text-align: left;
//   }

//   .mentor-ledger-table th,
//   .mentor-ledger-table td {
//     padding: 14px 12px;
//     border-bottom: 1px solid #262c48;
//     white-space: nowrap;
//   }

//   .mentor-ledger-table th {
//     color: #aeb3ce;
//     font-weight: 700;
//     background: #11162a;
//   }


//   .mentor-payout-list {
//     padding: 0 24px;
//   }

//   .mentor-payout {
//     display: flex;
//     justify-content: space-between;
//     align-items: center;
//     gap: 15px;
//     padding: 17px 0;
//     border-bottom: 1px solid #252b45;
//   }

//   .mentor-payout:last-child { border-bottom: 0; }

//   .mentor-payout strong {
//     display: block;
//     font-size: 13px;
//     margin-bottom: 6px;
//     overflow-wrap: anywhere;
//   }

//   .mentor-payout small {
//     color: #969bb8;
//     font-size: 11px;
//   }

//   .mentor-payout-amount {
//     font-size: 15px;
//     font-weight: 800;
//     text-align: right;
//     white-space: nowrap;
//   }

//   .mentor-payout-status {
//     margin-top: 5px;
//     text-align: right;
//     color: #c4b5fd;
//     font-size: 11px;
//     text-transform: capitalize;
//   }

//   .mentor-footer {
//     padding: 25px;
//     text-align: center;
//     color: #777e9d;
//     border-top: 1px solid #1e243b;
//     font-size: 13px;
//     line-height: 1.8;
//   }

//   @media (max-width: 900px) {
//       .mentor-stats {
//       grid-template-columns: repeat(2, minmax(0, 1fr));
//     }
//     .mentor-bookings { grid-template-columns: 1fr; }
//   }

//   @media (max-width: 600px) {
//     .mentor-nav { padding: 17px 20px; }
//     .mentor-nav-links { gap: 12px; }
//     .mentor-nav-links a { font-size: 12px; }
//     .mentor-main { padding: 28px 15px 45px; }
//     .mentor-hero { padding: 28px 22px; }
//     .mentor-stats { gap: 10px; }
//     .mentor-stat { padding: 16px; }
//     .mentor-panel-head { padding: 18px; }
//     .mentor-filters { padding: 15px; }
//     .mentor-bookings { padding: 14px; }
//     .mentor-booking { padding: 16px; }
//     .mentor-payout-list { padding: 0 16px; }
//   }
// `;

// const FILTERS = [
//   "All",
//   "Pending",
//   "Confirmed",
//   "Completed",
//   "Cancelled",
//   "Other",
// ];

// const getList = (response) => {
//   const data = response?.data;
//   if (Array.isArray(data)) return data;
//   if (Array.isArray(data?.bookings)) return data.bookings;
//   if (Array.isArray(data?.data)) return data.data;
//   if (Array.isArray(data?.payments)) return data.payments;
//   if (Array.isArray(data?.payouts)) return data.payouts;
//   if (Array.isArray(data?.earnings)) return data.earnings;
//   return [];
// };

// const getStatus = (booking) =>
//   String(
//     booking?.status ||
//       booking?.bookingStatus ||
//       booking?.paymentStatus ||
//       "pending"
//   ).toLowerCase();

// const getStudentName = (booking) => {
//   const student =
//     booking?.student ||
//     booking?.user ||
//     booking?.studentId ||
//     booking?.userId;

//   if (typeof student === "string") return student;
//   return (
//     student?.name ||
//     student?.fullName ||
//     student?.username ||
//     booking?.studentName ||
//     booking?.userName ||
//     "Student"
//   );
// };


// const getDate = (booking) => {
//   const value =
//     booking?.slotStart ||
//     booking?.date ||
//     booking?.sessionDate ||
//     booking?.bookingDate ||
//     booking?.slotDate;

//   if (!value) return "Date not specified";

//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return String(value);

//   return date.toLocaleDateString("en-IN", {
//     day: "numeric",
//     month: "short",
//     year: "numeric",
//   });
// };

// const getTime = (booking) => {
//   const start = booking?.slotStart;

//   if (start) {
//     const date = new Date(start);
//     if (!Number.isNaN(date.getTime())) {
//       return date.toLocaleTimeString("en-IN", {
//         hour: "numeric",
//         minute: "2-digit",
//         hour12: true,
//       });
//     }
//   }

//   return (
//     booking?.time ||
//     booking?.slot ||
//     booking?.sessionTime ||
//     booking?.startTime ||
//     "Time not specified"
//   );
// };

// const getAmount = (item) => {
//   if (item?.pricePaise != null) {
//     const paise = Number(item.pricePaise);
//     return Number.isFinite(paise) ? paise / 100 : 0;
//   }

//   const value =
//     item?.amount ??
//     item?.price ??
//     item?.totalAmount ??
//     item?.earnings ??
//     item?.fee ??
//     0;

//   const amount = Number(value);
//   return Number.isFinite(amount) ? amount : 0;
// };

// const formatCurrency = (amount) =>
//   new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//     maximumFractionDigits: 2,
//   }).format(Number(amount) || 0);

// const getBookingId = (booking) =>
//   booking?._id || booking?.id || booking?.bookingId;

// const getSlotEnd = (booking) => {
//   const value =
//     booking?.slotEnd ||
//     booking?.endTime ||
//     booking?.sessionEndTime;

//   if (value) {
//     const end = new Date(value);
//     if (!Number.isNaN(end.getTime())) return end;
//   }

//   const dateValue =
//     booking?.slotStart ||
//     booking?.date ||
//     booking?.sessionDate ||
//     booking?.bookingDate ||
//     booking?.slotDate;

//   const endValue =
//     booking?.endTime ||
//     booking?.sessionEndTime;

//   if (!dateValue || !endValue) return null;

//   const date = new Date(dateValue);
//   if (Number.isNaN(date.getTime())) return null;

//   const match = String(endValue).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
//   if (!match) return null;

//   let hours = Number(match[1]);
//   const minutes = Number(match[2]);
//   const meridiem = match[3]?.toUpperCase();

//   if (meridiem === "PM" && hours < 12) hours += 12;
//   if (meridiem === "AM" && hours === 12) hours = 0;

//   date.setHours(hours, minutes, 0, 0);
//   return date;
// };


// export default function MentorDashboard() {
//   const navigate = useNavigate();
//   const { user, logout } = useAuth();

//   const [bookings, setBookings] = useState([]);
//   const [earnings, setEarnings] = useState(null);
//   const [payouts, setPayouts] = useState([]);
//   const [filter, setFilter] = useState("All");
//   const [earningsTab, setEarningsTab] = useState("overview");
//   const [loading, setLoading] = useState(true);
//   const [completingId, setCompletingId] = useState(null);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   const displayName =
//     user?.name || user?.fullName || user?.username || "Mentor";

//   const loadDashboard = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     const errors = [];

//     try {
//       const response = await api.get("/mentors/my-bookings");
//       setBookings(getList(response));
//     } catch (err) {
//       errors.push(
//         err?.response?.data?.message || "Bookings load nahi ho paayin."
//       );
//       setBookings([]);
//     }

//     try {
//       const response = await api.get("/mentors/earnings");
//       const data = response?.data;
//       setEarnings(data?.earnings ?? data?.data ?? data ?? null);

//       if (Array.isArray(data?.payouts)) {
//         setPayouts(data.payouts);
//       } else if (Array.isArray(data?.payoutHistory)) {
//         setPayouts(data.payoutHistory);
//       } else if (Array.isArray(data?.history)) {
//         setPayouts(data.history);
//       } else {
//         setPayouts([]);
//       }
//     } catch (err) {
//       errors.push(
//         err?.response?.data?.message || "Earnings load nahi ho paayin."
//       );
//       setEarnings(null);
//       setPayouts([]);
//     }

//     if (errors.length) setError(errors.join(" "));
//     setLoading(false);
//   }, []);

//   useEffect(() => {
//     loadDashboard();
//   }, [loadDashboard]);

//   const handleLogout = async () => {
//     try {
//       await logout();
//       navigate("/login");
//     } catch (err) {
//       console.error("Logout failed:", err);
//       setError("Logout nahi ho paya. Dobara try karein.");
//     }
//   };

//   const handleComplete = async (booking) => {
//     const bookingId = getBookingId(booking);

//     if (!bookingId) {
//       setError("Booking ID nahi mili, is session ko complete nahi kar sakte.");
//       return;
//     }

//     const end = getSlotEnd(booking);

//     if (!end) {
//       setError(
//         "Session ka end time nahi mil raha. Booking details mein date aur slotEnd/endTime check karein."
//       );
//       return;
//     }

//     if (new Date() < end) {
//       setError(
//         `Session ${end.toLocaleString("en-IN")} se pehle complete nahi kiya ja sakta.`
//       );
//       return;
//     }

//     setCompletingId(String(bookingId));
//     setError("");
//     setSuccess("");

//     try {
//       await api.patch(`/bookings/${bookingId}/complete`);
//       setSuccess("Session successfully complete ho gaya!");
//       await loadDashboard();
//     } catch (err) {
//       setError(
//         err?.response?.data?.message ||
//           "Session complete nahi hua. Please dobara try karein."
//       );
//     } finally {
//       setCompletingId(null);
//     }
//   };

//   const filteredBookings = useMemo(() => {
//     if (filter === "All") return bookings;

//     return bookings.filter((booking) => {
//       const status = getStatus(booking);

//       if (filter === "Pending") return status === "pending";
//       if (filter === "Confirmed")
//         return ["confirmed", "approved", "accepted", "booked"].includes(status);
//       if (filter === "Completed")
//         return ["completed", "complete"].includes(status);
//       if (filter === "Cancelled")
//         return ["cancelled", "canceled", "rejected"].includes(status);

//       return ![
//         "pending",
//         "confirmed",
//         "approved",
//         "accepted",
//         "booked",
//         "completed",
//         "complete",
//         "cancelled",
//         "canceled",
//         "rejected",
//       ].includes(status);
//     });
//   }, [bookings, filter]);

//   const countByStatus = (statuses) =>
//     bookings.filter((booking) => statuses.includes(getStatus(booking))).length;

//   const totalBookings = bookings.length;
//   const pendingBookings = countByStatus(["pending"]);
//   const completedBookings = countByStatus(["completed", "complete"]);

  
//     const earningsAmount = (() => {
//     if (typeof earnings === "number" || typeof earnings === "string") {
//       return Number(earnings) || 0;
//     }

//     // The earnings API returns summary amounts in paise.
//     const summary = earnings?.summary;

//     if (
//       Number.isFinite(summary?.totalCompletedEarningsPaise)
//     ) {
//       return summary.totalCompletedEarningsPaise / 100;
//     }

//     // Legacy API response fallback (amounts already in rupees).
//     return Number(
//       earnings?.totalEarnings ??
//         earnings?.total ??
//         earnings?.earned ??
//         earnings?.availableBalance ??
//         earnings?.balance ??
//         earnings?.amount ??
//         0
//     ) || 0;
//   })();

  
// const isCompleteAllowed = (booking) => {
//   const status = getStatus(booking);

//   // Only confirmed sessions can be completed.
//   if (status !== "confirmed") {
//     return false;
//   }

//   const end = getSlotEnd(booking);

//   // Session must have a valid end time and must have ended.
//   return Boolean(end && new Date() >= end);
// };

//   const earningsSummary = earnings?.summary || earnings || {};

  
//   const earningsLedger = Array.isArray(earnings?.ledger)
//     ? earnings.ledger
//     : Array.isArray(earnings?.records)
//     ? earnings.records
//     : Array.isArray(earnings?.items)
//     ? earnings.items
//     : [];


//   const getRupees = (...values) => {
//     const value = values.find(
//       (item) => item != null && Number.isFinite(Number(item))
//     );

//     return value == null ? 0 : Number(value) / 100;
//   };

//   const pendingEarnings = getRupees(
//     earningsSummary.pendingEarningsPaise
//   );

//   const heldEarnings = getRupees(
//     earningsSummary.onHoldEarningsPaise,
//     earningsSummary.pendingEligibilityPaise
//   );

//   const eligibleEarnings = getRupees(
//     earningsSummary.eligibleUnpaidEarningsPaise
//   );

//   const processingEarnings = getRupees(
//     earningsSummary.processingPayoutsPaise
//   );

//   const paidEarnings = getRupees(
//     earningsSummary.paidPayoutsPaise,
//     earningsSummary.totalPaidPaise
//   );

//     const onHoldEarnings = getRupees(
//     earningsSummary.onHoldEarningsPaise
//   );


//   return (
//     <div className="mentor-page">
//       <style>{styles}</style>

//       <nav className="mentor-nav">
//         <Link to="/" className="mentor-brand">THRONE8</Link>

//         <div className="mentor-nav-links">
//           <Link to="/">Home</Link>
//           <Link to="/mentor-dashboard">Dashboard</Link>
//           <button className="mentor-logout" onClick={handleLogout}>
//             Logout ↗
//           </button>
//         </div>
//       </nav>

//       <main className="mentor-main">
//         <section className="mentor-hero">
//           <div className="mentor-eyebrow">Mentor Workspace</div>
//           <h1>Welcome back, {displayName}!</h1>
//           <p>
//             Manage your mentorship sessions, track your earnings, and keep
//             your student appointments organized — all from one place.
//           </p>
//         </section>

//         {error && <div className="mentor-error">{error}</div>}
//         {success && <div className="mentor-success">{success}</div>}

//                 <section className="mentor-stats">
//           {[
//             {
//               label: "Total Earned",
//               value: formatCurrency(earningsAmount),
//               note: "Completed session earnings",
//             },
//             {
//               label: "Pending Earnings",
//               value: formatCurrency(pendingEarnings),
//               note: "Awaiting eligibility",
//             },
//             {
//               label: "15-Day Hold",
//               value: formatCurrency(heldEarnings),
//               note: "Waiting period / hold",
//             },
//             {
//               label: "Eligible for Payout",
//               value: formatCurrency(eligibleEarnings),
//               note: "Not yet transferred",
//             },
//             {
//               label: "Processing",
//               value: formatCurrency(processingEarnings),
//               note: "Payout being processed",
//             },
//             {
//               label: "Paid Out",
//               value: formatCurrency(paidEarnings),
//               note: "Provider-confirmed payouts",
//             },
//                         {
//               label: "On Hold",
//               value: formatCurrency(onHoldEarnings),
//               note: "Blocked by refund, dispute, or review",
//             },
//           ].map((item) => (
//             <div className="mentor-stat" key={item.label}>
//               <div className="mentor-stat-label">{item.label}</div>
//               <div className="mentor-stat-value">
//                 {loading ? "—" : item.value}
//               </div>
//               <div className="mentor-stat-note">{item.note}</div>
//             </div>
//           ))}
//         </section>

//         <section className="mentor-panel">
//           <div className="mentor-panel-head">
//             <div>
//               <h3>Student Bookings</h3>
//               <p>Review your sessions and update their completion status.</p>
//             </div>

//             <button
//               className="mentor-refresh"
//               onClick={loadDashboard}
//               disabled={loading}
//             >
//               {loading ? "Refreshing..." : "↻ Refresh"}
//             </button>
//           </div>

//           <div className="mentor-filters">
//             {FILTERS.map((item) => (
//               <button
//                 key={item}
//                 className={`mentor-filter ${filter === item ? "active" : ""}`}
//                 onClick={() => setFilter(item)}
//               >
//                 {item}
//                 {item === "All" ? ` (${bookings.length})` : ""}
//               </button>
//             ))}
//           </div>

//           <div className="mentor-bookings">
//             {loading ? (
//               <div className="mentor-empty">Loading your bookings...</div>
//             ) : filteredBookings.length === 0 ? (
//               <div className="mentor-empty">
//                 <div style={{ fontSize: 30, marginBottom: 12 }}>▤</div>
//                 <strong>No bookings found</strong>
//                 <div>
//                   {filter === "All"
//                     ? "Your student bookings will appear here when available."
//                     : `There are no ${filter.toLowerCase()} bookings right now.`}
//                 </div>
//               </div>
//             ) : (
//               filteredBookings.map((booking, index) => {
//                 const bookingId = getBookingId(booking);
//                 const status = getStatus(booking);
//                 const canComplete = isCompleteAllowed(booking);

//                 return (
//                   <article
//                     className="mentor-booking"
//                     key={bookingId || `${getStudentName(booking)}-${index}`}
//                   >
//                     <div className="mentor-booking-top">
//                       <div>
//                         <h4>{getStudentName(booking)}</h4>
//                         <div className="mentor-booking-sub">
//                           Booking ID: {bookingId || "Not available"}
//                         </div>
//                       </div>

//                       <span className={`mentor-status ${status}`}>
//                         {status}
//                       </span>
//                     </div>

//                     <div className="mentor-booking-details">
//                       <div className="mentor-detail-row">
//                         <span>Session date</span>
//                         <span>{getDate(booking)}</span>
//                       </div>

//                       <div className="mentor-detail-row">
//                         <span>Session time</span>
//                         <span>{getTime(booking)}</span>
//                       </div>

//                       <div className="mentor-detail-row">
//                         <span>Session amount</span>
//                         <span>{formatCurrency(getAmount(booking))}</span>
//                       </div>

//                       <div className="mentor-detail-row">
//                         <span>Payment status</span>
//                         <span>
//                           {booking?.paymentStatus ||
//                             booking?.payment?.status ||
//                             "Not specified"}
//                         </span>
//                       </div>
//                     </div>

//                     {["completed", "complete"].includes(status) ? (
//                       <button className="mentor-complete-btn" disabled>
//                         ✓ Session Completed
//                       </button>
//                     ) : (
//                       <button
//                         className="mentor-complete-btn"
//                         disabled={!canComplete || completingId === String(bookingId)}
//                         onClick={() => handleComplete(booking)}
//                         title={
//                           canComplete
//                             ? "Mark this session as completed"
//                             : "This option becomes available after the session end time"
//                         }
//                       >
//                         {completingId === String(bookingId)
//                           ? "Completing..."
//                           : canComplete
//                           ? "✓ Mark Session Complete"
//                           : "Complete After Session Ends"}
//                       </button>
//                     )}
//                   </article>
//                 );
//               })
//             )}
//           </div>
//         </section>

//         {/* <section className="mentor-panel">
//           <div className="mentor-panel-head">
//             <div>
//               <h3>Earnings & Payout History</h3>
//               <p>Review your available earnings and recent payout records.</p>
//             </div>
//           </div>

//           {loading ? (
//             <div className="mentor-empty">Loading earnings...</div>
//           ) : payouts.length === 0 ? (
//             <div className="mentor-empty">
//               No payout history available yet.
//             </div>
//           ) : (
//             <div className="mentor-payout-list">
//               {payouts.map((payout, index) => {
//                 const payoutId = payout?._id || payout?.id || index;
//                 const payoutStatus =
//                   payout?.status || payout?.payoutStatus || "pending";

//                 return (
//                   <div className="mentor-payout" key={payoutId}>
//                     <div>
//                       <strong>
//                         {payout?.reference ||
//                           payout?.transactionId ||
//                           payout?.description ||
//                           `Payout #${index + 1}`}
//                       </strong>
//                       <small>
//                         {getDate(payout)}
//                       </small>
//                     </div>

//                     <div>
//                       <div className="mentor-payout-amount">
//                         {formatCurrency(getAmount(payout))}
//                       </div>
//                       <div className="mentor-payout-status">
//                         {payoutStatus}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </section> */}
        
//         <section className="mentor-panel">
//           <div className="mentor-panel-head">
//             <div>
//               <h3>
//                 {earningsTab === "overview" && "Earnings Overview"}
//                 {earningsTab === "ledger" && "Earnings Ledger"}
//                 {earningsTab === "payouts" && "Payout History"}
//                 {earningsTab === "statements" && "Statements"}
//               </h3>
//               <p>
//                 Review your earnings, eligibility, payout records, and monthly statements.
//               </p>
//             </div>
//           </div>

//           <div className="mentor-earnings-tabs">
//             {[
//               { id: "overview", label: "Overview" },
//               { id: "ledger", label: "Earnings Ledger" },
//               { id: "payouts", label: "Payout History" },
//               { id: "statements", label: "Statements" },
//             ].map((tab) => (
//               <button
//                 key={tab.id}
//                 type="button"
//                 className={`mentor-earnings-tab ${
//                   earningsTab === tab.id ? "active" : ""
//                 }`}
//                 onClick={() => setEarningsTab(tab.id)}
//               >
//                 {tab.label}
//               </button>
//             ))}
//           </div>

//           {earningsTab === "overview" && (
//             <div className="mentor-payout-list">
//               <div className="mentor-payout">
//                 <div>
//                   <strong>Total Earned</strong>
//                   <small>Completed session earnings</small>
//                 </div>
//                 <div className="mentor-payout-amount">
//                   {formatCurrency(earningsAmount)}
//                 </div>
//               </div>

//               <div className="mentor-payout">
//                 <div>
//                   <strong>Pending Eligibility</strong>
//                   <small>Subject to the 15-day waiting period</small>
//                 </div>
//                 <div className="mentor-payout-amount">
//                   {formatCurrency(heldEarnings)}
//                 </div>
//               </div>

//               <div className="mentor-payout">
//                 <div>
//                   <strong>Eligible for Payout</strong>
//                   <small>Not yet transferred</small>
//                 </div>
//                 <div className="mentor-payout-amount">
//                   {formatCurrency(eligibleEarnings)}
//                 </div>
//               </div>
//             </div>
//           )}

         
//           {earningsTab === "ledger" && (
//             <div className="mentor-ledger-wrap">
//               {loading ? (
//                 <div className="mentor-empty">Loading earnings ledger...</div>
//               ) : earningsLedger.length === 0 ? (
//                 <div className="mentor-empty">
//                   No earnings ledger records are available yet.
//                 </div>
//               ) : (
//                 <div style={{ overflowX: "auto" }}>
//                   <table className="mentor-ledger-table">
//                     <thead>
//                       <tr>
//                         <th>Booking</th>
//                         <th>Student</th>
//                         <th>Session Date</th>
//                         <th>Session Fee</th>
//                         <th>Commission</th>
//                         <th>You Earn</th>
//                         <th>Status</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {earningsLedger.map((record, index) => {
//                         const booking =
//                           record?.booking || record?.bookingId || {};
//                         const bookingId =
//                           typeof booking === "object"
//                             ? booking?._id || booking?.id
//                             : booking;
//                         const feePaise =
//                           record?.sessionFeePaise ??
//                           record?.amountPaise ??
//                           record?.grossAmountPaise;
//                         const commissionPaise = record?.commissionPaise;
//                         const mentorPaise =
//                           record?.mentorGrossPaise ??
//                           record?.mentorEarningsPaise ??
//                           record?.netAmountPaise;

//                         const rupees = (paise) =>
//                           Number.isFinite(Number(paise))
//                             ? formatCurrency(Number(paise) / 100)
//                             : "—";

//                         return (
//                           <tr
//                             key={
//                               record?._id ||
//                               bookingId ||
//                               `ledger-${index}`
//                             }
//                           >
//                             <td>{bookingId || "—"}</td>
//                             <td>
//                               {record?.studentName ||
//                                 booking?.studentName ||
//                                 record?.student?.name ||
//                                 "—"}
//                             </td>
//                             <td>
//                               {record?.sessionDate
//                                 ? getDate({ date: record.sessionDate })
//                                 : booking?.sessionDate
//                                 ? getDate({ date: booking.sessionDate })
//                                 : "—"}
//                             </td>
//                             <td>{rupees(feePaise)}</td>
//                             <td>{rupees(commissionPaise)}</td>
//                             <td>{rupees(mentorPaise)}</td>
//                             <td>
//                               {record?.status ||
//                                 record?.ledgerStatus ||
//                                 "—"}
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>
//           )}


//           {earningsTab === "payouts" && (
//             loading ? (
//               <div className="mentor-empty">Loading payout history...</div>
//             ) : payouts.length === 0 ? (
//               <div className="mentor-empty">
//                 No payout history available yet.
//               </div>
//             ) : (
//               <div className="mentor-payout-list">
//                 {payouts.map((payout, index) => {
//                   const payoutId = payout?._id || payout?.id || index;
//                   const payoutStatus =
//                     payout?.status || payout?.payoutStatus || "pending";

//                   return (
//                     <div className="mentor-payout" key={payoutId}>
//                       <div>
//                         <strong>
//                           {payout?.reference ||
//                             payout?.transactionId ||
//                             payout?.description ||
//                             `Payout #${index + 1}`}
//                         </strong>
//                         <small>{getDate(payout)}</small>
//                       </div>

//                       <div>
//                         <div className="mentor-payout-amount">
//                           {formatCurrency(getAmount(payout))}
//                         </div>
//                         <div className="mentor-payout-status">
//                           {payoutStatus}
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )
//           )}

//           {earningsTab === "statements" && (
//             <div className="mentor-empty">
//               Monthly statements UI will be added in the next step.
//             </div>
//           )}
//         </section>

//       </main>

//       <footer className="mentor-footer">
//         <strong>THRONE8</strong>
//         <div>Empowering your journey through mentorship.</div>
//         <div>© {new Date().getFullYear()} THRONE8. All rights reserved.</div>
//       </footer>
//     </div>
//   );
// }

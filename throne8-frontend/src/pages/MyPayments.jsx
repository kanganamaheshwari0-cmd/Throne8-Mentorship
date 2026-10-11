import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../services/api";

function formatDate(date) {
  if (!date) return "Not available";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function MyPayments() {
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
      setPayments(response.data.payments || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your payment history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app">
      <header className="navbar">
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </nav>

        <div className="nav-actions">
          <button
            className="btn btn-outline"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>
          <button
            className="btn btn-primary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-page">
        <section className="dashboard-welcome">
          <p className="eyebrow">STUDENT DASHBOARD</p>
          <h1>Payment History</h1>
          <p>
            Welcome{user?.name ? `, ${user.name}` : ""}.
            View your mentorship payment records.
          </p>
          <button
            className="btn btn-outline"
            onClick={fetchPayments}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Payments"}
          </button>
        </section>

        {loading ? (
          <p>Loading your payments...</p>
        ) : error ? (
          <section className="dashboard-card">
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={fetchPayments}
            >
              Try Again
            </button>
          </section>
        ) : payments.length === 0 ? (
          <section className="dashboard-card">
            <h2>No payment records yet</h2>
            <p>Your completed and pending payment records will appear here.</p>
          </section>
        ) : (
          <>
            <p>
              Total payment records:{" "}
              <strong>{payments.length}</strong>
            </p>

            <section className="dashboard-grid">
              {payments.map((payment) => (
                <article
                  className="dashboard-card"
                  key={payment._id}
                >
                  <p className="eyebrow">PAYMENT RECORD</p>

                  <h2>
                    ₹{(payment.amountPaise || 0) / 100}
                  </h2>

                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`status status-${payment.status.toLowerCase()}`}>
                      {payment.status}
                    </span>
                  </p>

                  <p>
                    <strong>Currency:</strong>{" "}
                    {payment.currency || "INR"}
                  </p>

                  <p>
                    <strong>Payment date:</strong>{" "}
                    {formatDate(payment.capturedAt || payment.createdAt)}
                  </p>

                  <p className="profile-detail">
                    <strong>Booking ID:</strong>{" "}
                    {payment.bookingId?._id || payment.bookingId || "N/A"}
                  </p>
                </article>
              ))}
            </section>
          </>
        )}
      </main>

      <footer>
        <Link className="logo" to="/">
          THRONE<span>8</span>
        </Link>
        <p>Empowering your journey through mentorship.</p>
        <p>© 2026 THRONE8 Mentorship</p>
      </footer>
    </div>
  );
}

export default MyPayments;
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/stats");

      setStats(response.data.stats);
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
    const handleVerificationUpdate = () => {
      fetchStats();
    };
  
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

  const cards = stats
    ? [
        {
          title: "Total Users",
          value: stats.totalUsers,
        },
        {
          title: "Total Students",
          value: stats.totalStudents,
        },
        {
          title: "Total Mentors",
          value: stats.totalMentors,
        },
        {
          title: "Verified Mentors",
          value: stats.verifiedMentors,
        },
        {
          title: "Pending Verifications",
          value: stats.pendingMentorVerifications,
        },
        {
          title: "Total Bookings",
          value: stats.totalBookings,
        },
        {
          title: "Confirmed Bookings",
          value: stats.confirmedBookings,
        },
        {
          title: "Completed Bookings",
          value: stats.completedBookings,
        },
        {
          title: "Total Payments",
          value: stats.totalPayments,
        },
        {
          title: "Captured Payments",
          value: stats.capturedPayments,
        },
        {
          title: "Total Revenue",
          value: `₹${Number(
            stats.totalRevenue || 0
          ).toLocaleString("en-IN")}`,
        },
      ]
    : [];

  return (
    <main className="auth-page admin-dashboard">
      <section className="auth-card admin-dashboard-card">
        <div className="admin-dashboard-header">
          <div>
            <p className="eyebrow">
              THRONE8 ADMIN PORTAL
            </p>

            <h1>Admin Dashboard</h1>

            <p>
              Welcome, {user?.name || "Admin"}!
            </p>

            <p>
              Manage your mentorship platform from one place.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {error && (
          <div>
            <p className="auth-error" role="alert">
              {error}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={fetchStats}
            >
              Try Again
            </button>
          </div>
        )}

        {loading && <p>Loading dashboard statistics...</p>}

        {!loading && !error && stats && (
          <>
            <h2 className="admin-section-title">
              Platform Overview
            </h2>

            <div className="admin-stats">
              {cards.map((card) => (
                <article
                  className="admin-stat"
                  key={card.title}
                >
                  <span>{card.title}</span>
                  <h2>{card.value ?? 0}</h2>
                </article>
              ))}
            </div>

            <h2 className="admin-section-title">
              Mentor Management
            </h2>

            <div className="admin-management-card">
              <h3>Mentor Verification</h3>

              <p>
                Pending mentor verifications:{" "}
                {stats.pendingMentorVerifications ?? 0}
              </p>

              <p>
                Review mentor profiles and manage their
                verification status.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  navigate("/admin/mentors")
                }
              >
                Manage Mentors
              </button>
            </div>
          </>
        )}

        
        <h2 className="admin-section-title">
          Finance &amp; Payout Management
        </h2>
        
        <div className="admin-management-card">
          <h3>Mentor Payouts</h3>
        
          <p>
            Review mentor earnings, check payout eligibility,
            and manage payout approvals.
          </p>
        
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/admin/payouts")}
          >
            Manage Finance &amp; Payouts
          </button>
        </div>


        <button
          type="button"
          className="btn btn-outline admin-back-button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </section>
    </main>
  );
}

export default AdminDashboard;
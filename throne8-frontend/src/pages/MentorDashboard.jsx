
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

function MentorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [completingId, setCompletingId] = useState("");

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

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCompleteSession = async (booking) => {
    if (booking.status !== "CONFIRMED") {
      setError("Only confirmed bookings can be completed.");
      return;
    }

    if (new Date(booking.slotEnd).getTime() > Date.now()) {
      setError("You can complete the session after its end time.");
      return;
    }

    const shouldComplete = window.confirm(
      "Are you sure you want to mark this session as completed?"
    );

    if (!shouldComplete) return;

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

      // Refresh bookings to display the updated status.
      await fetchBookings();
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

  const formatPrice = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format((paise || 0) / 100);
  };

  const confirmed = bookings.filter(
    (booking) => booking.status === "CONFIRMED"
  ).length;

  const pending = bookings.filter(
    (booking) => booking.status === "PENDING_PAYMENT"
  ).length;

  const expired = bookings.filter(
    (booking) => booking.status === "EXPIRED"
  ).length;

  const completed = bookings.filter(
    (booking) => booking.status === "COMPLETED"
  ).length;

  return (
    <main className="auth-page mentor-dashboard">
      <section className="auth-card mentor-dashboard-card">
        <div className="mentor-dashboard-header">
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
        </div>

        <div className="mentor-stats">
          <article className="mentor-stat">
            <span>Total Bookings</span>
            <h2>{bookings.length}</h2>
          </article>

          <article className="mentor-stat">
            <span>Confirmed</span>
            <h2>{confirmed}</h2>
          </article>

          <article className="mentor-stat">
            <span>Pending Payment</span>
            <h2>{pending}</h2>
          </article>

          <article className="mentor-stat">
            <span>Completed</span>
            <h2>{completed}</h2>
          </article>

          <article className="mentor-stat">
            <span>Expired</span>
            <h2>{expired}</h2>
          </article>
        </div>

        <h2 className="mentor-bookings-title">
          My Session Bookings
        </h2>

        {success && (
          <p className="auth-success" role="status">
            {success}
          </p>
        )}

        {error && (
          <div>
            <p className="auth-error" role="alert">
              {error}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setError("");
                fetchBookings();
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {loading && <p>Loading bookings...</p>}

        {!loading && !error && bookings.length === 0 && (
          <p>No bookings found yet.</p>
        )}

        {!loading && bookings.length > 0 && (
          <div className="mentor-bookings-list">
            {bookings.map((booking) => {
              const isConfirmed =
                booking.status === "CONFIRMED";

              const sessionEnded =
                booking.slotEnd &&
                new Date(booking.slotEnd).getTime() <=
                  Date.now();

              const isCompleting =
                completingId === booking._id;

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
                  </div>

                  {isConfirmed && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          !sessionEnded || isCompleting
                        }
                        onClick={() =>
                          handleCompleteSession(booking)
                        }
                      >
                        {isCompleting
                          ? "Completing..."
                          : !sessionEnded
                            ? "Session Not Ended"
                            : "Complete Session"}
                      </button>

                      {!sessionEnded && (
                        <p>
                          You can complete this session after{" "}
                          {formatDate(booking.slotEnd)}.
                        </p>
                      )}
                    </div>
                  )}

                  {booking.status === "COMPLETED" && (
                    <p>
                      Session completed successfully.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

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

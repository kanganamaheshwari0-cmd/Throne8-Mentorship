
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function AdminMentors() {
  const navigate = useNavigate();

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifyingId, setVerifyingId] = useState("");

  // Fetch all mentors
  const fetchMentors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/mentors");

      setMentors(response.data.mentors || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load mentors."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  // Verify mentor
  const handleVerify = async (mentorId) => {
    try {
      setVerifyingId(mentorId);
      setError("");
      setMessage("");

      const response = await api.patch(
        `/admin/mentors/${mentorId}/verify`
      );

      setMessage(
        response.data.message ||
          "Mentor verified successfully."
      );

      await fetchMentors();

      // Notify dashboard to refresh statistics
      window.dispatchEvent(
        new Event("mentor-verification-updated")
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to verify mentor."
      );
    } finally {
      setVerifyingId("");
    }
  };

  return (
    <main className="auth-page admin-dashboard">
      <section className="auth-card admin-dashboard-card">
        <div className="admin-dashboard-header">
          <div>
            <p className="eyebrow">
              THRONE8 ADMIN PORTAL
            </p>

            <h1>Mentor Management</h1>

            <p>
              Review mentor profiles and verification status.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate("/admin-dashboard")}
          >
            Back to Dashboard
          </button>
        </div>

        {message && (
          <p role="status" className="auth-success">
            {message}
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
              onClick={fetchMentors}
            >
              Try Again
            </button>
          </div>
        )}

        <h2 className="admin-section-title">
          All Mentors ({mentors.length})
        </h2>

        {loading && <p>Loading mentors...</p>}

        {!loading && !error && mentors.length === 0 && (
          <p>No mentors found.</p>
        )}

        {!loading && !error && mentors.length > 0 && (
          <div className="admin-mentors-list">
            {mentors.map((mentor) => {
              const name =
                mentor.userId?.name || "Unknown Mentor";

              const email =
                mentor.userId?.email || "No email available";

              const expertise = Array.isArray(
                mentor.expertise
              )
                ? mentor.expertise
                : [];

              return (
                <article
                  className="admin-management-card"
                  key={mentor._id}
                >
                  <div className="admin-mentor-details">
                    <h3>{name}</h3>

                    <p>
                      <strong>Email:</strong> {email}
                    </p>

                    <p>
                      <strong>Expertise:</strong>{" "}
                      {expertise.length > 0
                        ? expertise.join(", ")
                        : "Not specified"}
                    </p>

                    <p>
                      <strong>Session Price:</strong>{" "}
                      ₹
                      {(
                        Number(
                          mentor.sessionPricePaise || 0
                        ) / 100
                      ).toLocaleString("en-IN")}
                    </p>

                    <p>
                      <strong>Status:</strong>{" "}
                      <span
                        className={
                          mentor.isVerified
                            ? "mentor-status-verified"
                            : "mentor-status-pending"
                        }
                      >
                        {mentor.isVerified
                          ? "Verified"
                          : "Pending Verification"}
                      </span>
                    </p>
                  </div>

                  {!mentor.isVerified && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={verifyingId === mentor._id}
                      onClick={() => handleVerify(mentor._id)}
                    >
                      {verifyingId === mentor._id
                        ? "Verifying..."
                        : "Verify Mentor"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

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

export default AdminMentors;

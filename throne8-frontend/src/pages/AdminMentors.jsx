
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const formatINR = (paise) =>
  (Number(paise || 0) / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

function AdminMentors() {
  const navigate = useNavigate();

  const [mentors, setMentors] = useState([]);
  const [commissionDrafts, setCommissionDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifyingId, setVerifyingId] = useState("");
  const [savingCommissionId, setSavingCommissionId] = useState("");

  const fetchMentors = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/mentors");
      const mentorList = response.data.mentors || [];

      setMentors(mentorList);

      setCommissionDrafts((previous) => {
        const next = {};

        mentorList.forEach((mentor) => {
          const currentRate = Number(
            mentor.commissionRateBps ?? 2000
          );
          

          next[mentor._id] =
            previous[mentor._id] !== undefined &&
            savingCommissionId !== mentor._id
              ? previous[mentor._id]
              : String(currentRate / 100);
        });

        return next;
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load mentors."
      );
    } finally {
      setLoading(false);
    }
  }, [savingCommissionId]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const handleVerify = async (mentorId) => {
    try {
      setVerifyingId(mentorId);
      setError("");
      setMessage("");

      const response = await api.patch(
        `/admin/mentors/${mentorId}/verify`
      );

      setMessage(
        response.data.message || "Mentor verified successfully."
      );

      await fetchMentors();

      window.dispatchEvent(
        new Event("mentor-verification-updated")
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to verify mentor."
      );
    } finally {
      setVerifyingId("");
    }
  };

  const handleCommissionChange = (mentorId, value) => {
    setCommissionDrafts((previous) => ({
      ...previous,
      [mentorId]: value,
    }));

    setError("");
    setMessage("");
  };

  const handleSaveCommission = async (mentor) => {
    const value = commissionDrafts[mentor._id];
    const percentage = Number(value);

    if (
      value === "" ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100 ||
      !Number.isInteger(percentage * 100)
    ) {
      setError(
        "Commission 0% se 100% ke beech honi chahiye, maximum 2 decimal places ke saath."
      );
      setMessage("");
      return;
    }

    const commissionRateBps = Math.round(percentage * 100);

    try {
      setSavingCommissionId(mentor._id);
      setError("");
      setMessage("");

      const response = await api.patch(
        `/admin/mentors/${mentor._id}/commission`,
        { commissionRateBps }
      );

      setMessage(
        response.data.message ||
          `Commission updated to ${percentage}% successfully.`
      );

      // Refresh mentor data after a successful save.
      const refreshed = await api.get("/admin/mentors");
      const mentorList = refreshed.data.mentors || [];

      setMentors(mentorList);

      setCommissionDrafts((previous) => {
        const next = { ...previous };

        mentorList.forEach((item) => {
          next[item._id] =
            item._id === mentor._id
              ? String(
                  response.data.commission?.commissionPercentage ??
                    percentage
                )
              : previous[item._id] ??
                String(Number(item.commissionRateBps ?? 2000) / 100);
        });

        return next;
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update mentor commission."
      );
    } finally {
      setSavingCommissionId("");
    }
  };

  return (
    <main className="auth-page admin-dashboard">
      <section className="auth-card admin-dashboard-card">
        <div className="admin-dashboard-header">
          <div>
            <p className="eyebrow">THRONE8 ADMIN PORTAL</p>
            <h1>Mentor Management</h1>
            <p>
              Manage mentor verification, session prices and platform
              commission.
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
            <p role="alert" className="auth-error">
              {error}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={fetchMentors}
              disabled={loading}
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

        {!loading && mentors.length > 0 && (
          <div className="admin-mentors-list">
            {mentors.map((mentor) => {
              const name =
                mentor.userId?.name || "Unknown Mentor";
              const email =
                mentor.userId?.email || "No email available";
              const expertise = Array.isArray(mentor.expertise)
                ? mentor.expertise
                : [];

              const sessionPricePaise = Number(
                mentor.sessionPricePaise || 0
              );

              const currentRateBps = Number(
                mentor.commissionRateBps ?? 2000
              );

              const draftValue =
                commissionDrafts[mentor._id] ??
                String(currentRateBps / 100);

              const draftPercentage = Number(draftValue);

              const validDraft =
                draftValue !== "" &&
                Number.isFinite(draftPercentage) &&
                draftPercentage >= 0 &&
                draftPercentage <= 100 &&
                Number.isInteger(draftPercentage * 100);

              const previewCommissionPaise = validDraft
                ? Math.round(
                    (sessionPricePaise * draftPercentage) / 100
                  )
                : 0;

              const previewMentorEarningsPaise =
                sessionPricePaise - previewCommissionPaise;

              const isSaving =
                savingCommissionId === mentor._id;

              const isUnchanged =
                validDraft &&
                Math.round(draftPercentage * 100) ===
                  currentRateBps;

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
                      {expertise.length
                        ? expertise.join(", ")
                        : "Not specified"}
                    </p>

                    <p>
                      <strong>Session Price:</strong>{" "}
                      {formatINR(sessionPricePaise)}
                    </p>

                    <p>
                      <strong>Verification:</strong>{" "}
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

                    {!mentor.isVerified && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={Boolean(verifyingId)}
                        onClick={() => handleVerify(mentor._id)}
                      >
                        {verifyingId === mentor._id
                          ? "Verifying..."
                          : "Verify Mentor"}
                      </button>
                    )}
                  </div>

                  <div className="admin-mentor-details">
                    <h3>Commission Management</h3>

                    <p>
                      <strong>Current Commission:</strong>{" "}
                      {(currentRateBps / 100).toFixed(2)}%
                    </p>

                    <label htmlFor={`commission-${mentor._id}`}>
                      Commission percentage (0–100%)
                    </label>

                    <input
                      id={`commission-${mentor._id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={draftValue}
                      onChange={(event) =>
                        handleCommissionChange(
                          mentor._id,
                          event.target.value
                        )
                      }
                      disabled={isSaving}
                    />

                    <div>
                      <p>
                        <strong>Platform commission:</strong>{" "}
                        {formatINR(previewCommissionPaise)}
                      </p>

                      <p>
                        <strong>Mentor earnings:</strong>{" "}
                        {formatINR(previewMentorEarningsPaise)}
                      </p>

                      <p>
                        <strong>Calculation:</strong>{" "}
                        {formatINR(sessionPricePaise)} session price
                        {" − "}
                        {formatINR(previewCommissionPaise)} commission
                        {" = "}
                        {formatINR(previewMentorEarningsPaise)}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        isSaving || !validDraft || isUnchanged
                      }
                      onClick={() => handleSaveCommission(mentor)}
                    >
                      {isSaving
                        ? "Saving..."
                        : "Save Commission"}
                    </button>

                    <p>
                      Changes apply to future bookings. Existing
                      booking ledger amounts are not recalculated by
                      this setting.
                    </p>
                  </div>
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

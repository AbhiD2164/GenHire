import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { jobApplications, getJob, applicationDecision } from "../api/jobs";
import { useToast } from "../context/ToastContext";
import StatusPill from "../components/StatusPill";

export default function JobApplications() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionModal, setActionModal] = useState(null); // { appId, applicantName, action }
  const [reasonText, setReasonText] = useState("Better skills in other candidates were found");
  const [submittingAction, setSubmittingAction] = useState(false);
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobData, appsData] = await Promise.all([
        getJob(id),
        jobApplications(id, statusFilter || undefined),
      ]);
      setJob(jobData);
      setApplications(appsData.results || appsData);
    } finally {
      setLoading(false);
    }
  }, [id, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleConfirmDecision(e) {
    e.preventDefault();
    if (!actionModal) return;
    setSubmittingAction(true);
    try {
      await applicationDecision(actionModal.appId, {
        action: actionModal.action,
        reason: reasonText,
      });
      showToast(
        actionModal.action === "select"
          ? `Candidate selected! Notification email sent immediately.`
          : `Candidate rejected. Notification email sent immediately.`,
        "success"
      );
      setActionModal(null);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not update application status.", "error");
    } finally {
      setSubmittingAction(false);
    }
  }

  return (
    <div className="page container">
      <Link to={`/jobs/${id}`} className="text-sm muted" style={{ display: "inline-block", marginBottom: 12 }}>
        ← Back to job
      </Link>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow">Recruiter Applicant Review</span>
          <h1>{job?.title || "Loading…"}</h1>
          <p className="muted">
            Evaluate applicants, inspect parsed resume skills and scores, and select or reject candidates with immediate email notification.
          </p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All candidate statuses</option>
          <option value="selected">Selected only</option>
          <option value="applied">In review (applied) only</option>
          <option value="rejected">Rejected only</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : applications.length === 0 ? (
        <div className="card empty-state" style={{ padding: 40, textAlign: "center" }}>
          <h3>No applicants found</h3>
          <p className="muted">Applicants for this role will appear here automatically.</p>
        </div>
      ) : (
        <div className="applicant-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {applications.map((app) => (
            <div key={app.id} className="card applicant-card" style={{ padding: 20 }}>
              <div className="applicant-card-main" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{app.applicant_name}</h3>
                  <p className="muted text-sm" style={{ margin: "2px 0 0" }}>{app.applicant_email}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill status={app.status} />
                  {app.rejection_stage && (
                    <span className="tag text-xs" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }}>
                      {app.rejection_stage === "rejected_by_system" ? "System Rejected" : "Recruiter Rejected"}
                    </span>
                  )}
                </div>
              </div>

              <div className="applicant-meta-row" style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span className="tag">📍 {app.parsed_location || "Location not detected"}</span>
                <span className="tag">🕒 {app.parsed_experience_label || "Experience noted"}</span>
                <span
                  className="tag"
                  style={{
                    background: app.score >= 0.8 ? "rgba(16, 185, 129, 0.15)" : app.score >= 0.6 ? "rgba(99, 102, 241, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: app.score >= 0.8 ? "#10b981" : app.score >= 0.6 ? "#6366f1" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  ATS Score: {Math.round((app.score || 0) * 100)}%
                </span>
              </div>

              {app.parsed_skills && (
                <div className="skill-chip-row" style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {app.parsed_skills.split(",").map((s, i) => (
                    <span key={i} className="tag tag-soft">{s.trim()}</span>
                  ))}
                </div>
              )}

              {app.feedback && (
                <p className="text-sm muted" style={{ marginTop: 12, background: "var(--bg-subtle, #181b22)", padding: 8, borderRadius: 6 }}>
                  <strong>Screening Note:</strong> {app.feedback}
                </p>
              )}

              {app.rejection_reason && (
                <p className="text-sm" style={{ color: "#ef4444", marginTop: 8 }}>
                  <strong>Rejection Reason:</strong> {app.rejection_reason}
                </p>
              )}

              <div className="applicant-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
                <a href={app.resume} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                  📄 View Resume File
                </a>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: "#10b981", color: "#fff", borderColor: "#10b981" }}
                    onClick={() => {
                      setActionModal({ appId: app.id, applicantName: app.applicant_name, action: "select" });
                      setReasonText("Strong alignment with required skills and qualifications");
                    }}
                  >
                    ✓ Select Candidate
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                    onClick={() => {
                      setActionModal({ appId: app.id, applicantName: app.applicant_name, action: "reject" });
                      setReasonText("Better skills in other candidates were found");
                    }}
                  >
                    ✕ Reject Candidate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 460, width: "100%", padding: 24 }}>
            <h3 style={{ margin: "0 0 8px" }}>
              {actionModal.action === "select" ? "Select Candidate" : "Reject Application"}
            </h3>
            <p className="muted text-sm" style={{ marginBottom: 16 }}>
              Candidate: <strong>{actionModal.applicantName}</strong>.
              The candidate will be notified immediately via email and their dashboard will reflect this stage.
            </p>

            <form onSubmit={handleConfirmDecision}>
              <div className="field">
                <label>Reason / Feedback Note</label>
                <textarea
                  rows={3}
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Reason for selection or rejection..."
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActionModal(null)}
                  disabled={submittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-sm ${actionModal.action === "select" ? "btn-primary" : "btn-outline"}`}
                  style={actionModal.action === "reject" ? { background: "#ef4444", color: "#fff", borderColor: "#ef4444" } : {}}
                  disabled={submittingAction}
                >
                  {submittingAction ? "Processing & Emailing…" : actionModal.action === "select" ? "Confirm Selection" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

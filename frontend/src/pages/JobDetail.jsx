import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getJob, applyToJob, deleteJob } from "../api/jobs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState(null); // { success: bool, message: string }
  const fileInputRef = useRef(null);
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    getJob(id).then(setJob).finally(() => setLoading(false));
  }, [id]);

  async function handleApply(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      showToast("Please choose your resume file (PDF or DOCX).", "error");
      return;
    }
    setApplying(true);
    try {
      const result = await applyToJob(id, file);
      const isSelected = result.status === "selected";
      const isRejected = result.status === "rejected";
      setOutcome({
        status: result.status,
        scorePercentage: result.score_percentage || Math.round((result.score || 0) * 100),
        message: result.candidate_message,
        stage: result.rejection_stage,
        reason: result.rejection_reason,
      });
      showToast("Application evaluated and result sent via email!", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not submit application.", "error");
    } finally {
      setApplying(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this job posting? This cannot be undone.")) return;
    await deleteJob(id);
    navigate("/dashboard");
  }

  if (loading) return <div className="container page"><div className="spinner" /></div>;
  if (!job) return <div className="container page"><p>Job not found.</p></div>;

  const isOwner = job.created_by === profile?.user_id;

  return (
    <div className="page container job-detail">
      <div className="job-detail-header card">
        <div>
          <span className="eyebrow">{job.industry.replaceAll("_", " ")}</span>
          <h1>{job.title}</h1>
          <p className="muted">
            {job.company_name || "Confidential company"}
            {job.location ? ` · ${job.location}` : ""} · {job.work_mode} · {job.job_type.replace("_", "-")}
          </p>
        </div>
        <div className="job-detail-tags">
          <span className="tag tag-amber">{job.required_experience_label} experience</span>
          {(job.salary_min || job.salary_max) && (
            <span className="tag">
              {job.salary_min ? `₹${job.salary_min.toLocaleString()}` : ""}
              {job.salary_max ? ` – ₹${job.salary_max.toLocaleString()}` : "+"}
            </span>
          )}
        </div>
      </div>

      <div className="job-detail-grid">
        <div className="card job-detail-main">
          <h3>About this role</h3>
          <p className="job-description">{job.description}</p>

          <h4 style={{ marginTop: 24 }}>Required skills</h4>
          <div className="skill-chip-row">
            {job.skills_required.split(",").map((s, i) => (
              <span key={i} className="tag">{s.trim()}</span>
            ))}
          </div>

          {job.good_to_have && (
            <>
              <h4 style={{ marginTop: 18 }}>Good to have</h4>
              <div className="skill-chip-row">
                {job.good_to_have.split(",").map((s, i) => (
                  <span key={i} className="tag tag-soft">{s.trim()}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card job-detail-side">
          {isOwner ? (
            <>
              <h4>Manage this posting</h4>
              <p className="muted text-sm">{job.applicant_count} applicant(s) so far.</p>
              <Link to={`/jobs/${job.id}/applications`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
                View applicants
              </Link>
              <button className="btn btn-danger btn-block" style={{ marginTop: 8 }} onClick={handleDelete}>
                Delete posting
              </button>
            </>
          ) : job.has_applied ? (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <h3>Already applied</h3>
              <p>You've already submitted an application for this role.</p>
            </div>
          ) : outcome ? (
            <OutcomeCard outcome={outcome} />
          ) : (
            <form onSubmit={handleApply}>
              <h4>Apply with your resume</h4>
              <p className="muted text-sm" style={{ marginBottom: 14 }}>
                We'll automatically screen your resume against this role's requirements.
              </p>
              <div className="field">
                <input type="file" accept=".pdf,.docx,.doc" ref={fileInputRef} required />
                <span className="field-hint">PDF or Word, up to 5MB.</span>
              </div>
              <button className="btn btn-amber btn-block" disabled={applying}>
                {applying ? "Screening resume…" : "Submit application"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function OutcomeCard({ outcome }) {
  const isSelected = outcome.status === "selected";
  const isRejected = outcome.status === "rejected";

  return (
    <div className={`outcome-card ${isSelected ? "outcome-success" : isRejected ? "outcome-fail" : "outcome-success"}`} style={{ padding: 18 }}>
      <div className="outcome-icon">{isSelected ? "✓" : isRejected ? "✕" : "ℹ"}</div>
      <h4 style={{ margin: "4px 0" }}>
        {isSelected ? "Application Selected!" : isRejected ? "Application Rejected by System" : "Application Received"}
      </h4>
      <div style={{ margin: "6px 0 10px" }}>
        <span className="tag" style={{ fontWeight: 600 }}>
          Resume ATS Score: {outcome.scorePercentage}%
        </span>
      </div>
      <p className="text-sm" style={{ margin: "6px 0" }}>{outcome.message}</p>
      {isRejected && outcome.reason && (
        <p className="text-xs" style={{ color: "#ef4444", marginTop: 6 }}>
          <strong>Reason: </strong>{outcome.reason}
        </p>
      )}
      <p className="text-xs muted" style={{ marginTop: 10 }}>
        An evaluation summary email was dispatched to your inbox. You can monitor this anytime on your Dashboard under 'Applied Jobs'.
      </p>
      <Link to="/dashboard" className="btn btn-outline btn-sm btn-block" style={{ marginTop: 12 }}>
        Go to Dashboard
      </Link>
    </div>
  );
}

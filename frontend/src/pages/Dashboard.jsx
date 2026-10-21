import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { myApplications, recruiterDashboard, getRuntimeSuggestions } from "../api/jobs";

export default function Dashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("applied");
  const [applications, setApplications] = useState([]);
  const [recruiterJobs, setRecruiterJobs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsData, suggData] = await Promise.all([
        myApplications().catch(() => ({ results: [] })),
        getRuntimeSuggestions().catch(() => ({ suggestions: [] })),
      ]);
      setApplications(appsData.results || appsData || []);
      setSuggestions(suggData.suggestions || []);

      if (profile?.role === "recruiter") {
        const jobs = await recruiterDashboard().catch(() => []);
        setRecruiterJobs(jobs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (!profile) return null;

  const appliedList = applications.filter((a) => a.status === "applied" || a.status === "consider" || a.status === "pending");
  const selectedList = applications.filter((a) => a.status === "selected");
  const rejectedList = applications.filter((a) => a.status === "rejected");

  const currentTabList =
    activeTab === "applied" ? appliedList : activeTab === "selected" ? selectedList : rejectedList;

  return (
    <div className="page container dashboard-page">
      {/* Header bar */}
      <div className="card dashboard-welcome-card" style={{ marginBottom: 24, padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="eyebrow" style={{ margin: 0 }}>Unified Workspace</span>
              {profile.role === "recruiter" ? (
                profile.is_recruiter_verified ? (
                  <span className="tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    ✓ Verified Recruiter ({profile.company_name || "Official"})
                  </span>
                ) : (
                  <span className="tag" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    ⚠ Recruiter (Pending Domain Verification)
                  </span>
                )
              ) : (
                <span className="tag" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                  ✓ Candidate Profile Active
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Welcome back, {profile.full_name || profile.username}</h1>
            <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>
              Real-time application tracking, automated ATS evaluation results, and RabbitMQ runtime recommendations.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/jobs" className="btn btn-outline btn-sm">Browse Open Roles</Link>
            <Link to="/resume-analysis" className="btn btn-outline btn-sm">Scan Resume ATS</Link>
            {profile.role === "recruiter" && (
              <Link to="/jobs/new" className="btn btn-primary btn-sm">+ Post a Job</Link>
            )}
          </div>
        </div>
      </div>

      {/* Recruiter Section if posted roles exist */}
      {profile.role === "recruiter" && recruiterJobs.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Your Posted Jobs ({recruiterJobs.length})</h2>
            <Link to="/jobs/new" className="btn btn-outline btn-sm">Post Another Role</Link>
          </div>
          <div className="dashboard-job-list">
            {recruiterJobs.map((job) => (
              <div key={job.id} className="card dashboard-job-row" style={{ padding: "16px 20px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{job.title}</h3>
                  <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
                    {job.company_name} · {job.location} · {job.is_active ? "Active" : "Closed"}
                  </p>
                </div>
                <div className="dashboard-job-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="tag" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}>
                    {job.applicant_count} applicant(s)
                  </span>
                  <Link to={`/jobs/${job.id}/applications`} className="btn btn-primary btn-sm">
                    Review Applicants
                  </Link>
                  <Link to={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Applied Jobs Section with 3 tabs: Applied, Selected, Rejected */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>Application Status Center</span>
            <h2 style={{ fontSize: "1.35rem", margin: 0 }}>Your Applied Jobs</h2>
          </div>

          {/* 3 Section Tabs */}
          <div className="tab-group" style={{ display: "flex", background: "var(--bg-subtle, #1e222b)", padding: 4, borderRadius: 8, gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "applied" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("applied")}
              style={{ borderRadius: 6 }}
            >
              Applied ({appliedList.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "selected" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("selected")}
              style={{ borderRadius: 6 }}
            >
              Selected ({selectedList.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "rejected" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("rejected")}
              style={{ borderRadius: 6 }}
            >
              Rejected ({rejectedList.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
        ) : currentTabList.length === 0 ? (
          <div className="card empty-state" style={{ padding: 40, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px" }}>No applications in '{activeTab}' category</h3>
            <p className="muted" style={{ margin: 0 }}>
              {activeTab === "applied"
                ? "You have no pending applications in review."
                : activeTab === "selected"
                ? "Applications with matching ATS scores (80-100%) or recruiter acceptances will appear here."
                : "No rejected applications found."}
            </p>
            {activeTab === "applied" && (
              <Link to="/jobs" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                Explore Open Positions
              </Link>
            )}
          </div>
        ) : (
          <div className="dashboard-job-list">
            {currentTabList.map((app) => {
              const isSelected = app.status === "selected";
              const isRejected = app.status === "rejected";

              return (
                <div key={app.id} className="card dashboard-job-row" style={{ padding: "20px 24px", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: "1.15rem" }}>{app.job_title}</h3>
                      <span className="muted text-sm">at {app.company_name}</span>
                      {app.location && <span className="muted text-sm">· {app.location}</span>}
                    </div>

                    {/* Resume Score & Status info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                      <span
                        className="tag"
                        style={{
                          background: isSelected
                            ? "rgba(16, 185, 129, 0.15)"
                            : isRejected
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(59, 130, 246, 0.15)",
                          color: isSelected ? "#10b981" : isRejected ? "#ef4444" : "#3b82f6",
                          fontWeight: 600,
                        }}
                      >
                        ATS Score: {app.score_percentage || round(app.score * 100, 1)}%
                      </span>

                      {isSelected && (
                        <span className="status-pill status-selected">✓ Selected by System / Recruiter</span>
                      )}

                      {!isSelected && !isRejected && (
                        <span className="status-pill status-pending">In Review (Partial Match)</span>
                      )}

                      {isRejected && (
                        <span className="status-pill status-rejected">
                          {app.rejection_stage === "rejected_by_system"
                            ? "Application rejected by system"
                            : "Application rejected by recruiter"}
                        </span>
                      )}
                    </div>

                    {/* Stage and Reason details */}
                    {isRejected && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 14px",
                          borderRadius: 6,
                          background: "rgba(239, 68, 68, 0.08)",
                          borderLeft: "3px solid #ef4444",
                          fontSize: "0.88rem",
                        }}
                      >
                        <strong>Stage: </strong>
                        <span>
                          {app.rejection_stage === "rejected_by_system"
                            ? "Automated System Screening (Score < 60% or Format/Security Policy)"
                            : "Recruiter Review"}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          <strong>Reason: </strong>
                          <span>{app.rejection_reason || app.feedback || "Did not meet requirement threshold."}</span>
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 14px",
                          borderRadius: 6,
                          background: "rgba(16, 185, 129, 0.08)",
                          borderLeft: "3px solid #10b981",
                          fontSize: "0.88rem",
                        }}
                      >
                        <strong>Status: </strong>
                        <span>{app.candidate_message || "Congratulations! Your profile was selected for this role."}</span>
                      </div>
                    )}

                    {!isSelected && !isRejected && (
                      <div className="text-sm muted" style={{ marginTop: 8 }}>
                        {app.candidate_message || "Application received and under review. Updates will be emailed immediately."}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <Link to={`/jobs/${app.job}`} className="btn btn-outline btn-sm">View Job</Link>
                    <span className="text-xs muted">
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Runtime Suggestions (Powered by RabbitMQ & Cache) */}
      <section style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>RabbitMQ Runtime Intelligence</span>
            <h2 style={{ fontSize: "1.35rem", margin: 0 }}>Recommended Jobs For You</h2>
          </div>
          <span className="tag" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}>
            Real-Time Cache Sync
          </span>
        </div>

        {suggestions.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p className="muted" style={{ margin: 0 }}>
              Apply to jobs or scan your resume to receive personalized runtime recommendations.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {suggestions.slice(0, 6).map((job) => (
              <div key={job.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span
                      className="tag text-xs"
                      style={{
                        background: job.match_type === "similar_to_profile" ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: job.match_type === "similar_to_profile" ? "#10b981" : "#6366f1",
                        fontWeight: 600,
                      }}
                    >
                      {job.match_type === "similar_to_profile" ? "★ Profile Match" : "⚡ Resume Strength Match"}
                    </span>
                    <span className="text-xs muted">{job.work_mode}</span>
                  </div>

                  <h3 style={{ fontSize: "1.05rem", margin: "4px 0" }}>{job.title}</h3>
                  <p className="text-sm muted" style={{ margin: "0 0 10px" }}>{job.company_name} · {job.location}</p>

                  <p className="text-xs muted" style={{ background: "var(--bg-subtle, #181b22)", padding: 8, borderRadius: 6, margin: "6px 0 12px" }}>
                    {job.reason}
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span className="text-xs" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
                    Match: {Math.round(job.match_score * 100)}%
                  </span>
                  <Link to={`/jobs/${job.id}`} className="btn btn-primary btn-sm">
                    View & Apply
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function round(val, dec = 1) {
  return Math.round((val || 0) * Math.pow(10, dec)) / Math.pow(10, dec);
}

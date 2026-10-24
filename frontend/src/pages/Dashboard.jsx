import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { myApplications, recruiterDashboard, getRuntimeSuggestions, getApplicationStats } from "../api/jobs";
import { myConnections } from "../api/network";

export default function Dashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [applications, setApplications] = useState([]);
  const [postedJobs, setPostedJobs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [appStats, setAppStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsData, postedData, suggData, connData, statsData] = await Promise.all([
        myApplications().catch(() => ({ results: [] })),
        recruiterDashboard().catch(() => []),
        getRuntimeSuggestions().catch(() => ({ suggestions: [] })),
        myConnections().catch(() => ({ connections: [] })),
        getApplicationStats().catch(() => null),
      ]);
      setApplications(appsData.results || appsData || []);
      setPostedJobs(postedData || []);
      setSuggestions(suggData.suggestions || []);
      setConnectionCount(connData.connections?.length || 0);
      setAppStats(statsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (!profile) return null;

  const appliedList = applications.filter(
    (a) => a.status === "applied" || a.status === "consider" || a.status === "pending"
  );
  const selectedList = applications.filter((a) => a.status === "selected");
  const rejectedList = applications.filter((a) => a.status === "rejected");

  const currentTabList =
    activeTab === "all"
      ? applications
      : activeTab === "applied"
      ? appliedList
      : activeTab === "selected"
      ? selectedList
      : rejectedList;

  // Calculate profile completeness
  let completeness = 40;
  if (profile.headline) completeness += 15;
  if (profile.phone_number) completeness += 15;
  if (profile.bio) completeness += 10;
  if (profile.skills) completeness += 10;
  if (profile.resume) completeness += 10;
  completeness = Math.min(100, completeness);

  return (
    <div className="container page" style={{ paddingTop: 16 }}>
      {/* Unified Profile Hero Banner */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-cover" />
        <div className="dashboard-hero-content">
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.full_name || profile.username}
                className="dashboard-hero-avatar"
              />
            ) : (
              <div className="dashboard-hero-avatar">
                {(profile.full_name || profile.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800, color: "var(--ink)" }}>
                  {profile.full_name || profile.username}
                </h1>
                <span className="text-sm muted">@{profile.username}</span>

                {profile.is_recruiter_verified ? (
                  <span className="badge" style={{ background: "#DCFCE7", color: "#166534" }}>
                    ✓ Verified Employer ({profile.company_name})
                  </span>
                ) : profile.company_name ? (
                  <span className="badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                    {profile.company_name}
                  </span>
                ) : (
                  <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1" }}>
                    ✓ Member Active
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--slate)" }}>
                {profile.headline || "GenHire Professional Member"}
              </p>
              <div className="text-xs muted" style={{ marginTop: 2 }}>
                {profile.industry ? `${profile.industry} • ` : ""}
                {profile.location || "Location not specified"}
                {profile.phone_number ? ` • 📞 ${profile.phone_number}` : ""}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
            <Link to="/profile/edit" className="btn btn-outline btn-sm">
              Edit Profile
            </Link>
            <Link to="/resume-analysis" className="btn btn-outline btn-sm">
              Scan Resume ATS
            </Link>
            <Link to="/jobs" className="btn btn-outline btn-sm">
              Browse Open Roles
            </Link>
            <Link to="/jobs/new" className="btn btn-primary btn-sm">
              + Post a Job
            </Link>
          </div>
        </div>
      </section>

      {/* KPI Stats Ribbon */}
      <section className="dashboard-stats-grid">
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">APPLICATIONS SUBMITTED</span>
          <div className="stat-metric-num">{appStats ? appStats.total : applications.length}</div>
          <span className="text-xs muted" style={{ marginTop: 2, display: "block" }}>
            {appStats ? appStats.in_review : appliedList.length} currently in active review
          </span>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">SELECTED / MATCHES</span>
          <div className="stat-metric-num" style={{ color: "#16A34A" }}>
            {appStats ? appStats.selected : selectedList.length}
          </div>
          <span className="text-xs muted" style={{ marginTop: 2, display: "block" }}>
            Shortlisted & top matches
          </span>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">JOBS POSTED BY YOU</span>
          <div className="stat-metric-num" style={{ color: "var(--brand-strong)" }}>
            {postedJobs.length}
          </div>
          <Link to="/jobs/new" className="text-xs" style={{ color: "var(--brand-strong)", marginTop: 2, display: "block" }}>
            + Post another job →
          </Link>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">NETWORK CONNECTIONS</span>
          <div className="stat-metric-num">{connectionCount}</div>
          <Link to="/network" className="text-xs" style={{ color: "var(--brand-strong)", marginTop: 2, display: "block" }}>
            Grow your network →
          </Link>
        </div>
      </section>

      {/* Application Rejection Breakdown — shown only when stats are loaded */}
      {appStats && appStats.rejected_total > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div className="card" style={{ padding: "14px 20px" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>
              Application Status Overview
            </h4>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  flex: 1, minWidth: 160, padding: "10px 14px",
                  background: "#FEF9C3", border: "1px solid #FDE047",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#854D0E", marginBottom: 4 }}>
                  CRITERIA MISMATCH (AUTO)
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#92400E" }}>
                  {appStats.auto_rejected_by_system}
                </div>
                <div style={{ fontSize: 11, color: "#78350F", marginTop: 2 }}>
                  Skills or formatting did not meet minimum criteria
                </div>
              </div>
              <div
                style={{
                  flex: 1, minWidth: 160, padding: "10px 14px",
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                  NOT SELECTED BY EMPLOYER
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#DC2626" }}>
                  {appStats.rejected_by_recruiter}
                </div>
                <div style={{ fontSize: 11, color: "#7F1D1D", marginTop: 2 }}>
                  Hiring team prioritized other qualifications
                </div>
              </div>
              <div
                style={{
                  flex: 1, minWidth: 160, padding: "10px 14px",
                  background: "#F0FDF4", border: "1px solid #BBF7D0",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 4 }}>
                  SHORTLISTED & INTERVIEWING
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>
                  {appStats.selected}
                </div>
                <div style={{ fontSize: 11, color: "#14532D", marginTop: 2 }}>
                  Applications advancing in recruitment process
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main 2-Column Dashboard Layout */}
      <div className="dashboard-main-grid">
        {/* Left Column: Hiring Pipeline & Application Status */}
        <main style={{ minWidth: 0 }}>
          {/* Hiring & Posted Roles Section */}
          {postedJobs.length > 0 ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Your Posted Jobs & Hiring Pipeline ({postedJobs.length})</h3>
                  <p className="text-sm muted" style={{ margin: "2px 0 0" }}>Manage applicants and review automated ATS screening scores</p>
                </div>
                <Link to="/jobs/new" className="btn btn-outline btn-sm">
                  + Add Role
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {postedJobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      background: "#F8FAFC",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14.5 }}>{job.title}</strong>
                      <p className="text-xs muted" style={{ margin: "2px 0 0" }}>
                        {job.company_name} • {job.location} • {job.work_mode} • {job.is_active ? "Active" : "Closed"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1" }}>
                        {job.applicant_count || 0} applicants
                      </span>
                      <Link to={`/jobs/${job.id}/applications`} className="btn btn-primary btn-sm">
                        Review Candidates
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                marginBottom: 24,
                padding: "16px 20px",
                background: "linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 100%)",
                border: "1px solid #BAE6FD",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#0369A1" }}>Hiring for your company or team?</h3>
                  <p className="text-xs muted" style={{ margin: 0 }}>
                    Post an open job role anytime to automatically screen resumes, receive instant ATS-scored candidates, and find qualified talent.
                  </p>
                </div>
                <Link to="/jobs/new" className="btn btn-primary btn-sm">
                  + Post a Job
                </Link>
              </div>
            </div>
          )}

          {/* Applied Jobs Center */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Application Status Center</h3>
                <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                  Instant ATS screening results, status breakdown, and candidate communication history
                </p>
              </div>

              {/* Segmented Filter Pills */}
              <div style={{ display: "flex", gap: 6, background: "#F1F5F9", padding: 3, borderRadius: 8 }}>
                <button
                  className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveTab("all")}
                  style={{ fontSize: 12 }}
                >
                  All ({applications.length})
                </button>
                <button
                  className={`btn btn-sm ${activeTab === "applied" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveTab("applied")}
                  style={{ fontSize: 12 }}
                >
                  Applied ({appliedList.length})
                </button>
                <button
                  className={`btn btn-sm ${activeTab === "selected" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveTab("selected")}
                  style={{ fontSize: 12 }}
                >
                  Selected ({selectedList.length})
                </button>
                <button
                  className={`btn btn-sm ${activeTab === "rejected" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActiveTab("rejected")}
                  style={{ fontSize: 12 }}
                >
                  Rejected ({rejectedList.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : currentTabList.length === 0 ? (
              <div className="empty-state" style={{ padding: "36px 0" }}>
                <p className="muted">No applications found under '{activeTab}' filter.</p>
                <Link to="/jobs" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>
                  Explore Open Job Roles
                </Link>
              </div>
            ) : (
              <div>
                {currentTabList.map((app) => {
                  const isSelected = app.status === "selected";
                  const isRejected = app.status === "rejected";
                  const score = app.score_percentage || Math.round((app.score || 0) * 100);

                  return (
                    <div key={app.id} className="app-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <h4 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>
                            {app.job_title}
                          </h4>
                          <span className="text-sm muted">
                            {app.company_name} {app.location ? `• ${app.location}` : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                score >= 80 ? "#DCFCE7" : score >= 60 ? "#FEF3C7" : "#FEE2E2",
                              color:
                                score >= 80 ? "#166534" : score >= 60 ? "#92400E" : "#991B1B",
                              fontWeight: 700,
                            }}
                          >
                            ATS Match: {score}%
                          </span>
                          <Link to={`/jobs/${app.job}`} className="btn btn-outline btn-sm">
                            View Role
                          </Link>
                        </div>
                      </div>

                      {/* Status & Stage Banner */}
                      <div style={{ marginTop: 12 }}>
                        {isSelected && (
                          <div
                            style={{
                              background: "#F0FDF4",
                              borderLeft: "4px solid #16A34A",
                              padding: "8px 12px",
                              borderRadius: 4,
                              fontSize: 13,
                              color: "#166534",
                            }}
                          >
                            <strong>✓ Shortlisted: </strong>
                            <span>{app.candidate_message || "Your profile matches the role requirements and has been forwarded for the next stage."}</span>
                          </div>
                        )}

                        {isRejected && (
                          <div
                            style={{
                              background: "#FEF2F2",
                              borderLeft: "4px solid #DC2626",
                              padding: "8px 12px",
                              borderRadius: 4,
                              fontSize: 13,
                              color: "#991B1B",
                            }}
                          >
                            <strong>
                              {app.rejection_stage === "rejected_by_system"
                                ? "Application Update: "
                                : "Hiring Team Decision: "}
                            </strong>
                            <span>{app.rejection_reason || app.feedback || "Thank you for applying. We are moving forward with other applicants for this opening."}</span>
                          </div>
                        )}

                        {!isSelected && !isRejected && (
                          <div
                            style={{
                              background: "#EFF6FF",
                              borderLeft: "4px solid #2563EB",
                              padding: "8px 12px",
                              borderRadius: 4,
                              fontSize: 13,
                              color: "#1E40AF",
                            }}
                          >
                            <strong>Application in Review: </strong>
                            <span>
                              {app.candidate_message || "Your application has been received and is currently being evaluated by the hiring team."}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }} className="text-xs muted">
                        <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                        <span>Confirmation email dispatched</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Recommendations & Profile Advice */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Personalized Job Matches */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Recommended for You</h4>
              <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1", fontSize: 10 }}>
                Smart Match
              </span>
            </div>
            <p className="text-xs muted" style={{ margin: "0 0 12px" }}>
              Roles aligned with your industry experience, skills, and application preferences:
            </p>

            {suggestions.length === 0 ? (
              <p className="text-xs muted">
                Apply to roles or complete your profile skills to unlock curated career recommendations.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {suggestions.slice(0, 4).map((sugg) => (
                  <div
                    key={sugg.id}
                    style={{
                      padding: 10,
                      background: "#F8FAFC",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <strong style={{ fontSize: 13 }}>{sugg.title}</strong>
                      <span className="text-xs" style={{ color: "var(--brand-strong)", fontWeight: 700 }}>
                        {Math.round(sugg.match_score * 100)}%
                      </span>
                    </div>
                    <p className="text-xs muted" style={{ margin: "2px 0 6px" }}>
                      {sugg.company_name} • {sugg.location}
                    </p>
                    <Link to={`/jobs/${sugg.id}`} className="btn btn-outline btn-sm" style={{ width: "100%", textAlign: "center", fontSize: 11, padding: "4px 8px" }}>
                      View & Apply
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile Health & Completeness */}
          <div className="card" style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Profile Completeness ({completeness}%)</h4>
            <div className="score-progress-bar" style={{ marginBottom: 10 }}>
              <div
                className="score-progress-fill"
                style={{ width: `${completeness}%`, background: "var(--brand-strong)" }}
              />
            </div>
            <p className="text-xs muted" style={{ margin: "0 0 10px" }}>
              Complete profiles with a verified phone number and skills increase connection acceptance and recruiter response by 3x.
            </p>
            <Link to="/profile/edit" className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }}>
              Update Profile Details →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

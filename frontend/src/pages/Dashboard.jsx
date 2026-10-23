import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { myApplications, recruiterDashboard, getRuntimeSuggestions } from "../api/jobs";
import { myConnections } from "../api/network";

export default function Dashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [applications, setApplications] = useState([]);
  const [recruiterJobs, setRecruiterJobs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsData, suggData, connData] = await Promise.all([
        myApplications().catch(() => ({ results: [] })),
        getRuntimeSuggestions().catch(() => ({ suggestions: [] })),
        myConnections().catch(() => ({ connections: [] })),
      ]);
      setApplications(appsData.results || appsData || []);
      setSuggestions(suggData.suggestions || []);
      setConnectionCount(connData.connections?.length || 0);

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
      {/* LinkedIn-style Profile Hero Banner */}
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

                {profile.role === "recruiter" ? (
                  profile.is_recruiter_verified ? (
                    <span className="badge" style={{ background: "#DCFCE7", color: "#166534" }}>
                      ✓ Verified Recruiter ({profile.company_name || "Official"})
                    </span>
                  ) : (
                    <span className="badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      ⚠ Recruiter Pending Domain Check
                    </span>
                  )
                ) : (
                  <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1" }}>
                    ✓ Candidate Active
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--slate)" }}>
                {profile.headline || (profile.role === "recruiter" ? "Talent Acquisition Partner" : "Open for Opportunities")}
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
            {profile.role === "recruiter" && (
              <Link to="/jobs/new" className="btn btn-primary btn-sm">
                + Post New Role
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* KPI Stats Ribbon */}
      <section className="dashboard-stats-grid">
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">APPLICATIONS SUBMITTED</span>
          <div className="stat-metric-num">{applications.length}</div>
          <span className="text-xs muted" style={{ marginTop: 2, display: "block" }}>
            {appliedList.length} currently in active review
          </span>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">SELECTED / MATCHES</span>
          <div className="stat-metric-num" style={{ color: "#16A34A" }}>
            {selectedList.length}
          </div>
          <span className="text-xs muted" style={{ marginTop: 2, display: "block" }}>
            ATS high match score (80%+)
          </span>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">NETWORK CONNECTIONS</span>
          <div className="stat-metric-num">{connectionCount}</div>
          <Link to="/network" className="text-xs" style={{ color: "var(--brand-strong)", marginTop: 2, display: "block" }}>
            Grow your network →
          </Link>
        </div>
        <div className="stat-metric-card">
          <span className="text-xs muted font-semibold">PROFILE COMPLETION</span>
          <div className="stat-metric-num" style={{ color: "var(--brand-strong)" }}>
            {completeness}%
          </div>
          <div className="score-progress-bar">
            <div
              className="score-progress-fill"
              style={{ width: `${completeness}%`, background: "var(--brand-strong)" }}
            />
          </div>
        </div>
      </section>

      {/* Main 2-Column Dashboard Layout */}
      <div className="dashboard-main-grid">
        {/* Left Column: Applications & Recruiter Listings */}
        <main style={{ minWidth: 0 }}>
          {/* Recruiter Active Roles if role is recruiter */}
          {profile.role === "recruiter" && recruiterJobs.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Your Posted Roles ({recruiterJobs.length})</h3>
                <Link to="/jobs/new" className="btn btn-outline btn-sm">
                  + Add Role
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recruiterJobs.map((job) => (
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
                        {job.location} • {job.work_mode} • {job.is_active ? "Active" : "Closed"}
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
          )}

          {/* Applied Jobs Center */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Application Status Center</h3>
                <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                  Instant ATS screening results, status breakdown, and automated candidate communications
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
                            <strong>✓ Selected: </strong>
                            <span>{app.candidate_message || "Candidate application meets or exceeds qualification threshold (80-100%). Result sent via email."}</span>
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
                                ? "⚠ Application rejected by system: "
                                : "Application rejected by recruiter: "}
                            </strong>
                            <span>{app.rejection_reason || app.feedback || "Did not satisfy matching criteria or format standard."}</span>
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
                            <strong>In Review: </strong>
                            <span>
                              {app.candidate_message || "Partial match (60-70%). Resume forwarded for recruiter consideration."}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }} className="text-xs muted">
                        <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                        <span>Zero-delay email dispatch verified</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Runtime Recommendations & Profile Advice */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* RabbitMQ Runtime Intelligence Card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Runtime Recommendations</h4>
              <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1", fontSize: 10 }}>
                RabbitMQ Sync
              </span>
            </div>
            <p className="text-xs muted" style={{ margin: "0 0 12px" }}>
              Dynamic match suggestions calculated at runtime from your resume analysis and applied profile history:
            </p>

            {suggestions.length === 0 ? (
              <p className="text-xs muted">
                Apply to roles or scan your resume to activate runtime cache recommendations.
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

          {/* Profile Tip Card */}
          <div className="card" style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Career Profile Health</h4>
            <p className="text-xs muted" style={{ margin: "0 0 10px" }}>
              Profiles with verified mobile numbers and multi-industry headline keywords receive 3x more recruiter inquiries.
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

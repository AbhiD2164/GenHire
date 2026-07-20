import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { jobApplications, getJob } from "../api/jobs";
import StatusPill from "../components/StatusPill";

export default function JobApplications() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

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

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="page container">
      <Link to={`/jobs/${id}`} className="text-sm muted" style={{ display: "inline-block", marginBottom: 12 }}>← Back to job</Link>
      <div className="page-header">
        <div>
          <span className="eyebrow">Applicants</span>
          <h1>{job?.title || "Loading…"}</h1>
          <p className="muted">
            Only candidates who passed the resume screen appear here. Rejected applications are never surfaced.
          </p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All visible statuses</option>
          <option value="selected">Selected only</option>
          <option value="consider">Consider only</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <h3>No qualifying applicants yet</h3>
          <p>Candidates who clear the resume screen for this role will show up here.</p>
        </div>
      ) : (
        <div className="applicant-list">
          {applications.map((app) => (
            <ApplicantCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicantCard({ app }) {
  return (
    <div className="card applicant-card">
      <div className="applicant-card-main">
        <div>
          <h3>{app.applicant_name}</h3>
          <p className="muted text-sm">{app.applicant_email}</p>
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="applicant-meta-row">
        <span className="tag">📍 {app.parsed_location || "Location not detected"}</span>
        <span className="tag">🕒 {app.parsed_experience_label} experience</span>
        <span className="tag tag-amber">Fit score: {Math.round(app.score * 100)}%</span>
      </div>

      {app.parsed_skills && (
        <div className="skill-chip-row" style={{ marginTop: 10 }}>
          {app.parsed_skills.split(",").map((s, i) => (
            <span key={i} className="tag tag-soft">{s.trim()}</span>
          ))}
        </div>
      )}

      {app.feedback && (
        <p className="text-sm muted" style={{ marginTop: 12 }}>
          <strong>Screening note:</strong> {app.feedback}
        </p>
      )}

      <div className="applicant-actions">
        <a href={app.resume} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">View resume</a>
      </div>
    </div>
  );
}

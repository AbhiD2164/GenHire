import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { recruiterDashboard, myApplications } from "../api/jobs";
import StatusPill from "../components/StatusPill";

export default function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === "recruiter" ? <RecruiterDashboard /> : <ApplicantDashboard />;
}

function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recruiterDashboard().then(setJobs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Recruiter dashboard</span>
          <h1>Your job postings</h1>
        </div>
        <Link to="/jobs/new" className="btn btn-amber">Post a job</Link>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs posted yet</h3>
          <p>Post your first role to start receiving screened applicants.</p>
        </div>
      ) : (
        <div className="dashboard-job-list">
          {jobs.map((job) => (
            <div key={job.id} className="card dashboard-job-row">
              <div>
                <h3>{job.title}</h3>
                <p className="muted text-sm">{job.company_name} · {job.location} · {job.is_active ? "Active" : "Closed"}</p>
              </div>
              <div className="dashboard-job-actions">
                <span className="tag tag-amber">{job.applicant_count} qualified applicant(s)</span>
                <Link to={`/jobs/${job.id}/applications`} className="btn btn-outline btn-sm">View applicants</Link>
                <Link to={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">View posting</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicantDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myApplications().then((data) => setApplications(data.results || data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page container">
      <span className="eyebrow">Your applications</span>
      <h1>Application history</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        We only show the outcome message here — never the internal scoring details.
      </p>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : applications.length === 0 ? (
        <div className="empty-state">
          <h3>You haven't applied to any roles yet</h3>
          <Link to="/jobs" className="btn btn-amber" style={{ marginTop: 16 }}>Browse jobs</Link>
        </div>
      ) : (
        <div className="dashboard-job-list">
          {applications.map((app) => {
            const success = app.candidate_message?.toLowerCase().includes("successfully");
            return (
              <div key={app.id} className="card dashboard-job-row">
                <div>
                  <h3>{app.job_title}</h3>
                  <p className="muted text-sm">{app.company_name}</p>
                </div>
                <span className={`status-pill ${success ? "status-selected" : "status-rejected"}`}>
                  {success ? "Submitted" : "Not suitable"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { listJobs } from "../api/jobs";
import { useAuth } from "../context/AuthContext";

const INDUSTRIES = [
  ["", "All industries"],
  ["information_technology", "Information Technology"],
  ["healthcare", "Healthcare"],
  ["finance", "Finance & Accounting"],
  ["education", "Education"],
  ["sales_marketing", "Sales & Marketing"],
  ["design_creative", "Design & Creative"],
  ["operations_logistics", "Operations & Logistics"],
  ["human_resources", "Human Resources"],
  ["legal", "Legal"],
  ["manufacturing", "Manufacturing & Engineering"],
  ["hospitality", "Hospitality & Travel"],
  ["construction", "Construction & Real Estate"],
  ["retail", "Retail & Customer Service"],
  ["media", "Media & Communications"],
  ["science_research", "Science & Research"],
  ["other", "Other"],
];

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [workMode, setWorkMode] = useState("");
  const { profile } = useAuth();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (industry) params.industry = industry;
      if (workMode) params.work_mode = workMode;
      const data = await listJobs(params);
      setJobs(data.results || data);
    } finally {
      setLoading(false);
    }
  }, [search, industry, workMode]);

  useEffect(() => {
    const timer = setTimeout(fetchJobs, 300);
    return () => clearTimeout(timer);
  }, [fetchJobs]);

  return (
    <div className="page container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Open roles</span>
          <h1>Find your next role</h1>
          <p className="muted">Across every industry — not just tech.</p>
        </div>
        {profile?.role === "recruiter" && (
          <Link to="/jobs/new" className="btn btn-amber">Post a job</Link>
        )}
      </div>

      <div className="filter-bar card">
        <input
          type="text"
          placeholder="Search by title, company, or skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {INDUSTRIES.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
          <option value="">Any work mode</option>
          <option value="onsite">On-site</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No roles match yet</h3>
          <p>Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }) {
  return (
    <Link to={`/jobs/${job.id}`} className="job-card card">
      <div className="job-card-top">
        <div>
          <h3>{job.title}</h3>
          <p className="muted text-sm">{job.company_name || "Confidential company"} {job.location ? `· ${job.location}` : ""}</p>
        </div>
        <span className="tag">{job.work_mode}</span>
      </div>
      <p className="job-card-desc text-sm muted">{job.description.slice(0, 140)}{job.description.length > 140 ? "…" : ""}</p>
      <div className="job-card-meta">
        <span className="tag tag-amber">{job.required_experience_label}</span>
        {job.skills_required.split(",").slice(0, 3).map((s, i) => (
          <span key={i} className="tag">{s.trim()}</span>
        ))}
      </div>
      {job.has_applied && <span className="applied-badge">Applied</span>}
    </Link>
  );
}

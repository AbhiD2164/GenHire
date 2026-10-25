import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob } from "../api/jobs";
import { useToast } from "../context/ToastContext";

const INDUSTRIES = [
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

const initial = {
  title: "", company_name: "", industry: "information_technology",
  job_type: "full_time", work_mode: "onsite", location: "",
  description: "", skills_required: "", good_to_have: "", education_requirements: "",
  min_experience_years: 0, max_experience_years: "",
  salary_min: "", salary_max: "",
};

export default function CreateJob() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        max_experience_years: form.max_experience_years === "" ? null : Number(form.max_experience_years),
        salary_min: form.salary_min === "" ? null : Number(form.salary_min),
        salary_max: form.salary_max === "" ? null : Number(form.salary_max),
      };
      const job = await createJob(payload);
      showToast("Job posted successfully!", "success");
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? Object.values(data)[0] : null;
      showToast(Array.isArray(firstError) ? firstError[0] : firstError || "Could not post job.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page container">
      <span className="eyebrow">New posting</span>
      <h1>Post a job, any role</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Define the skills and experience you need — resume matching supports applicants across industries.
      </p>

      <form onSubmit={handleSubmit} className="card form-card">
        <div className="field-row">
          <div className="field">
            <label>Job title *</label>
            <input value={form.title} onChange={(e) => update("title", e.target.value)} required placeholder="e.g. Senior Accountant" />
          </div>
          <div className="field">
            <label>Company name</label>
            <input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Industry</label>
            <select value={form.industry} onChange={(e) => update("industry", e.target.value)}>
              {INDUSTRIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Location</label>
            <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Pune, Maharashtra" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Job type</label>
            <select value={form.job_type} onChange={(e) => update("job_type", e.target.value)}>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
          <div className="field">
            <label>Work mode</label>
            <select value={form.work_mode} onChange={(e) => update("work_mode", e.target.value)}>
              <option value="onsite">On-site</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Description *</label>
          <textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} required />
        </div>

        <div className="field">
          <label>Required skills *</label>
          <input
            value={form.skills_required}
            onChange={(e) => update("skills_required", e.target.value)}
            required
            placeholder="Comma-separated, any domain: e.g. nursing, patient care, CPR"
          />
          <span className="field-hint">Applicants are screened against these — works for any industry, not just tech.</span>
        </div>

        <div className="field">
          <label>Good to have</label>
          <input value={form.good_to_have} onChange={(e) => update("good_to_have", e.target.value)} placeholder="Comma-separated, optional" />
        </div>

        <div className="field">
          <label>Education requirements (optional)</label>
          <input
            value={form.education_requirements}
            onChange={(e) => update("education_requirements", e.target.value)}
            placeholder="e.g. Bachelor's degree in accounting or equivalent"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Minimum experience (years)</label>
            <input type="number" min="0" step="0.5" value={form.min_experience_years} onChange={(e) => update("min_experience_years", e.target.value)} />
          </div>
          <div className="field">
            <label>Maximum experience (years, optional)</label>
            <input type="number" min="0" step="0.5" value={form.max_experience_years} onChange={(e) => update("max_experience_years", e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Salary min (optional)</label>
            <input type="number" min="0" value={form.salary_min} onChange={(e) => update("salary_min", e.target.value)} />
          </div>
          <div className="field">
            <label>Salary max (optional)</label>
            <input type="number" min="0" value={form.salary_max} onChange={(e) => update("salary_max", e.target.value)} />
          </div>
        </div>

        <button className="btn btn-amber btn-block" disabled={submitting}>
          {submitting ? "Posting…" : "Post job"}
        </button>
      </form>
    </div>
  );
}

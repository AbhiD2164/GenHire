import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateMe, listExperience, addExperience, deleteExperience } from "../api/auth";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    headline: "",
    bio: "",
    location: "",
    skills: "",
    company_name: "",
    company_website: "",
  });
  const [experiences, setExperiences] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const resumeInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || "",
        first_name: profile.full_name?.split(" ")[0] || "",
        last_name: profile.full_name?.split(" ").slice(1).join(" ") || "",
        headline: profile.headline || "",
        bio: profile.bio || "",
        location: profile.location || "",
        skills: profile.skills || "",
        company_name: profile.company_name || "",
        company_website: profile.company_website || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    listExperience().then((data) => setExperiences(data.results || data));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMe(form);
      await refreshProfile();
      showToast("Profile and username updated successfully.", "success");
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not update profile.";
      showToast(msg, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleResumeUpload() {
    const file = resumeInputRef.current?.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext)) {
      showToast("Invalid file. Only PDF (.pdf) and Word (.docx) files are accepted.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    try {
      await updateMe(formData, true);
      await refreshProfile();
      showToast("Resume uploaded and parsed successfully.", "success");
    } catch {
      showToast("Could not upload resume.", "error");
    }
  }

  async function handleAvatarUpload() {
    const file = avatarInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      await updateMe(formData, true);
      await refreshProfile();
      showToast("Photo updated.", "success");
    } catch {
      showToast("Could not upload photo.", "error");
    }
  }

  if (!profile) return null;

  return (
    <div className="page container profile-page">
      <div className="card profile-header-card" style={{ marginBottom: 24, padding: "24px 28px" }}>
        <div className="profile-avatar-row" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div className="profile-avatar-wrap" onClick={() => avatarInputRef.current?.click()} style={{ cursor: "pointer" }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="profile-avatar-lg" />
            ) : (
              <div className="profile-avatar-lg profile-avatar-fallback">
                {(profile.full_name || profile.username || "?")[0].toUpperCase()}
              </div>
            )}
            <span className="avatar-edit-hint">Change</span>
          </div>
          <input type="file" accept="image/*" hidden ref={avatarInputRef} onChange={handleAvatarUpload} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0 }}>{profile.full_name}</h1>
              <span className="text-sm muted">(@{profile.username})</span>
            </div>
            <p className="muted" style={{ margin: "4px 0 8px" }}>{profile.headline || "Add a headline to stand out"}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="tag">{profile.role === "recruiter" ? "Recruiter" : "Job seeker"}</span>
              {profile.role === "recruiter" && (
                profile.is_recruiter_verified ? (
                  <span className="tag" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                    ✓ Corporate Domain Verified
                  </span>
                ) : (
                  <span className="tag" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    ⚠ Domain Verification Pending
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        <form onSubmit={saveProfile} className="card profile-form" style={{ padding: "24px" }}>
          <h3 style={{ marginTop: 0 }}>Profile Details & Credentials</h3>

          <div className="field-row">
            <div className="field">
              <label>Username (Change anytime)</label>
              <input
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="e.g. john_doe"
                required
              />
            </div>
            <div className="field">
              <label>Email Address</label>
              <input value={profile.email || ""} disabled style={{ opacity: 0.7 }} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>First Name</label>
              <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Professional Headline</label>
            <input
              value={form.headline}
              onChange={(e) => update("headline", e.target.value)}
              placeholder="e.g. Senior Software Architect | Python & Cloud Systems"
            />
          </div>

          <div className="field">
            <label>Location</label>
            <input
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="City, State/Country"
            />
          </div>

          {profile.role === "recruiter" && (
            <div className="field-row">
              <div className="field">
                <label>Company Name</label>
                <input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="e.g. Acme Corporation"
                />
              </div>
              <div className="field">
                <label>Company Website</label>
                <input
                  value={form.company_website}
                  onChange={(e) => update("company_website", e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label>About / Bio</label>
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Summarize your experience, leadership, and accomplishments..."
            />
          </div>

          <div className="field">
            <label>Skills (Comma-separated)</label>
            <textarea
              rows={2}
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
              placeholder="e.g. Python, Django, React, AWS, Kubernetes, Project Management"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving Changes…" : "Save Profile"}
          </button>
        </form>

        <div className="profile-side">
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Resume & Documents</h3>
            <p className="muted text-sm">
              Total career experience detected:{" "}
              <strong>
                {Math.floor(profile.total_experience_months / 12)} yr {profile.total_experience_months % 12} mo
              </strong>
            </p>
            {profile.resume && (
              <a
                href={profile.resume}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm btn-block"
                style={{ marginBottom: 12, textAlign: "center" }}
              >
                📄 View Current Resume
              </a>
            )}
            <label className="text-xs muted" style={{ display: "block", marginBottom: 6 }}>
              Upload new resume (.pdf or .docx only):
            </label>
            <input type="file" accept=".pdf,.docx,.doc" ref={resumeInputRef} onChange={handleResumeUpload} />
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Work Experience</h3>
            <ExperienceList experiences={experiences} setExperiences={setExperiences} />
            <AddExperienceForm onAdded={(exp) => setExperiences((e) => [exp, ...e])} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperienceList({ experiences, setExperiences }) {
  async function handleDelete(id) {
    await deleteExperience(id);
    setExperiences((exps) => exps.filter((e) => e.id !== id));
  }

  if (experiences.length === 0) {
    return <p className="muted text-sm">No work experience added yet.</p>;
  }

  return (
    <div className="experience-list">
      {experiences.map((exp) => (
        <div key={exp.id} className="experience-item" style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>{exp.job_title || "Untitled role"}</strong>
              <p className="muted text-sm" style={{ margin: "2px 0" }}>{exp.company}</p>
              <p className="text-xs muted" style={{ margin: 0 }}>
                {MONTHS[(exp.start_month || 1) - 1]} {exp.start_year} – {exp.is_current ? "Present" : `${MONTHS[(exp.end_month || 1) - 1]} ${exp.end_year}`}
                {exp.source === "resume" && <span className="tag tag-soft" style={{ marginLeft: 8 }}>From resume</span>}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(exp.id)} style={{ color: "#ef4444" }}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddExperienceForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    job_title: "",
    company: "",
    start_month: 1,
    start_year: new Date().getFullYear(),
    end_month: 1,
    end_year: new Date().getFullYear(),
    is_current: false,
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    if (payload.is_current) {
      payload.end_month = null;
      payload.end_year = null;
    }
    const exp = await addExperience(payload);
    onAdded(exp);
    setOpen(false);
    setForm({
      job_title: "",
      company: "",
      start_month: 1,
      start_year: new Date().getFullYear(),
      end_month: 1,
      end_year: new Date().getFullYear(),
      is_current: false,
    });
  }

  if (!open) {
    return (
      <button className="btn btn-outline btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => setOpen(true)}>
        + Add Experience
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="add-experience-form" style={{ marginTop: 14 }}>
      <div className="field">
        <label>Job Title</label>
        <input value={form.job_title} onChange={(e) => update("job_title", e.target.value)} required />
      </div>
      <div className="field">
        <label>Company</label>
        <input value={form.company} onChange={(e) => update("company", e.target.value)} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Start Month</label>
          <select value={form.start_month} onChange={(e) => update("start_month", Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Start Year</label>
          <input type="number" value={form.start_year} onChange={(e) => update("start_year", Number(e.target.value))} />
        </div>
      </div>
      <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
        <input type="checkbox" checked={form.is_current} onChange={(e) => update("is_current", e.target.checked)} />
        I currently work here
      </label>
      {!form.is_current && (
        <div className="field-row">
          <div className="field">
            <label>End Month</label>
            <select value={form.end_month} onChange={(e) => update("end_month", Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>End Year</label>
            <input type="number" value={form.end_year} onChange={(e) => update("end_year", Number(e.target.value))} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" type="submit">Save Experience</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

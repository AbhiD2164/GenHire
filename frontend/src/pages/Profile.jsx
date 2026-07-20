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

  const [form, setForm] = useState({ headline: "", bio: "", location: "", skills: "", company_name: "" });
  const [experiences, setExperiences] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const resumeInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        headline: profile.headline || "",
        bio: profile.bio || "",
        location: profile.location || "",
        skills: profile.skills || "",
        company_name: profile.company_name || "",
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
      showToast("Profile updated.", "success");
    } catch {
      showToast("Could not update profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleResumeUpload(e) {
    const file = resumeInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("resume", file);
    try {
      await updateMe(formData, true);
      await refreshProfile();
      showToast("Resume uploaded.", "success");
    } catch {
      showToast("Could not upload resume.", "error");
    }
  }

  async function handleAvatarUpload(e) {
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
      <div className="card profile-header-card">
        <div className="profile-avatar-row">
          <div className="profile-avatar-wrap" onClick={() => avatarInputRef.current?.click()}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="profile-avatar-lg" />
            ) : (
              <div className="profile-avatar-lg profile-avatar-fallback">
                {(profile.full_name || "?")[0].toUpperCase()}
              </div>
            )}
            <span className="avatar-edit-hint">Change</span>
          </div>
          <input type="file" accept="image/*" hidden ref={avatarInputRef} onChange={handleAvatarUpload} />
          <div>
            <h1>{profile.full_name}</h1>
            <p className="muted">{profile.headline || "Add a headline to stand out"}</p>
            <span className="tag">{profile.role === "recruiter" ? "Recruiter" : "Job seeker"}</span>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        <form onSubmit={saveProfile} className="card profile-form">
          <h3>About</h3>
          <div className="field">
            <label>Headline</label>
            <input value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="e.g. Senior Civil Engineer | Structural Design" />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, State/Country" />
          </div>
          {profile.role === "recruiter" && (
            <div className="field">
              <label>Company</label>
              <input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Bio</label>
            <textarea rows={4} value={form.bio} onChange={(e) => update("bio", e.target.value)} />
          </div>
          <div className="field">
            <label>Skills</label>
            <textarea rows={2} value={form.skills} onChange={(e) => update("skills", e.target.value)} placeholder="Comma-separated, any domain" />
          </div>
          <button className="btn btn-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save changes"}</button>
        </form>

        <div className="profile-side">
          {profile.role === "applicant" && (
            <div className="card">
              <h3>Resume</h3>
              <p className="muted text-sm">
                Total experience detected: <strong>{Math.floor(profile.total_experience_months / 12)} yr {profile.total_experience_months % 12} mo</strong>
              </p>
              {profile.resume && (
                <a href={profile.resume} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm btn-block" style={{ marginBottom: 8 }}>
                  View current resume
                </a>
              )}
              <input type="file" accept=".pdf,.docx,.doc" ref={resumeInputRef} onChange={handleResumeUpload} />
            </div>
          )}

          <div className="card">
            <h3>Work experience</h3>
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
        <div key={exp.id} className="experience-item">
          <div>
            <strong>{exp.job_title || "Untitled role"}</strong>
            <p className="muted text-sm">{exp.company}</p>
            <p className="text-sm muted">
              {MONTHS[(exp.start_month || 1) - 1]} {exp.start_year} – {exp.is_current ? "Present" : `${MONTHS[(exp.end_month || 1) - 1]} ${exp.end_year}`}
              {exp.source === "resume" && <span className="tag tag-soft" style={{ marginLeft: 8 }}>From resume</span>}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(exp.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

function AddExperienceForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    job_title: "", company: "", start_month: 1, start_year: new Date().getFullYear(),
    end_month: 1, end_year: new Date().getFullYear(), is_current: false,
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
    setForm({ job_title: "", company: "", start_month: 1, start_year: new Date().getFullYear(), end_month: 1, end_year: new Date().getFullYear(), is_current: false });
  }

  if (!open) {
    return <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>+ Add experience</button>;
  }

  return (
    <form onSubmit={handleSubmit} className="add-experience-form">
      <div className="field">
        <label>Job title</label>
        <input value={form.job_title} onChange={(e) => update("job_title", e.target.value)} required />
      </div>
      <div className="field">
        <label>Company</label>
        <input value={form.company} onChange={(e) => update("company", e.target.value)} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Start month</label>
          <select value={form.start_month} onChange={(e) => update("start_month", Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Start year</label>
          <input type="number" value={form.start_year} onChange={(e) => update("start_year", Number(e.target.value))} />
        </div>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={form.is_current} onChange={(e) => update("is_current", e.target.checked)} />
        I currently work here
      </label>
      {!form.is_current && (
        <div className="field-row">
          <div className="field">
            <label>End month</label>
            <select value={form.end_month} onChange={(e) => update("end_month", Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>End year</label>
            <input type="number" value={form.end_year} onChange={(e) => update("end_year", Number(e.target.value))} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm">Save</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  updateMe,
  listExperience,
  addExperience,
  updateExperience,
  deleteExperience,
  listEducation,
  addEducation,
  updateEducation,
  deleteEducation,
  listAchievements,
  addAchievement,
  updateAchievement,
  deleteAchievement,
} from "../api/auth";

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
    phone_number: "",
    headline: "",
    industry: "",
    bio: "",
    location: "",
    skills: "",
    company_name: "",
    company_website: "",
  });
  const [experiences, setExperiences] = useState([]);
  const [education, setEducation] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const resumeInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || "",
        first_name: profile.full_name?.split(" ")[0] || "",
        last_name: profile.full_name?.split(" ").slice(1).join(" ") || "",
        phone_number: profile.phone_number || "",
        headline: profile.headline || "",
        industry: profile.industry || "",
        bio: profile.bio || "",
        location: profile.location || "",
        skills: profile.skills || "",
        company_name: profile.company_name || "",
        company_website: profile.company_website || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    async function loadProfileSections() {
      try {
        const [experienceData, educationData, achievementData] = await Promise.all([
          listExperience(),
          listEducation(),
          listAchievements(),
        ]);
        setExperiences(experienceData.results || experienceData);
        setEducation(educationData.results || educationData);
        setAchievements(achievementData.results || achievementData);
      } catch {
        showToast("Could not load all profile sections.", "error");
      }
    }
    loadProfileSections();
  }, [showToast]);

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
            <p className="muted" style={{ margin: "4px 0 4px" }}>{profile.headline || "Add a headline to stand out"}</p>
            <p className="text-sm muted" style={{ margin: "0 0 8px" }}>
              {[profile.industry, profile.location].filter(Boolean).join(" · ") || "Add your industry and location"}
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="tag">Active Member</span>
              {profile.company_name && (
                <span className="tag">{profile.company_name}</span>
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

          <div className="field-row">
            <div className="field">
              <label>Phone number (private)</label>
              <input type="tel" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, State/Country" />
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
            <label>Industry</label>
            <input
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
              placeholder="e.g. Healthcare, Finance, Education, Technology"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Current company / organization</label>
              <input
                value={form.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="e.g. Acme Corporation"
              />
            </div>
            <div className="field">
              <label>Company website</label>
              <input
                type="url"
                value={form.company_website}
                onChange={(e) => update("company_website", e.target.value)}
                placeholder="https://acme.com"
              />
            </div>
          </div>

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

          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Education</h3>
            <EducationList education={education} setEducation={setEducation} />
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Achievements & Certifications</h3>
            <AchievementList achievements={achievements} setAchievements={setAchievements} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperienceList({ experiences, setExperiences }) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState(null);

  async function handleDelete(id) {
    try {
      await deleteExperience(id);
      setExperiences((exps) => exps.filter((e) => e.id !== id));
    } catch {
      showToast("Could not remove experience.", "error");
    }
  }

  if (experiences.length === 0) {
    return <p className="muted text-sm">No work experience added yet.</p>;
  }

  return (
    <div className="experience-list">
      {experiences.map((exp) => (
        <div key={exp.id} className="experience-item" style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {editingId === exp.id ? (
            <EditExperienceForm
              experience={exp}
              onCancel={() => setEditingId(null)}
              onSaved={(updated) => {
                setExperiences((items) => items.map((item) => item.id === updated.id ? updated : item));
                setEditingId(null);
              }}
            />
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <strong>{exp.job_title || "Untitled role"}</strong>
                <p className="muted text-sm" style={{ margin: "2px 0" }}>{exp.company}</p>
                <p className="text-xs muted" style={{ margin: 0 }}>
                  {MONTHS[(exp.start_month || 1) - 1]} {exp.start_year} – {exp.is_current ? "Present" : `${MONTHS[(exp.end_month || 1) - 1]} ${exp.end_year}`}
                  {exp.source === "resume" && <span className="tag tag-soft" style={{ marginLeft: 8 }}>From resume</span>}
                </p>
              </div>
              <div className="profile-entry-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(exp.id)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(exp.id)} style={{ color: "#ef4444" }}>
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditExperienceForm({ experience, onCancel, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ ...experience });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateExperience(experience.id, form);
      onSaved(updated);
    } catch {
      showToast("Could not update experience.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="profile-entry-form">
      <div className="field-row">
        <div className="field"><label>Role</label><input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} required /></div>
        <div className="field"><label>Company</label><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>Start year</label><input type="number" value={form.start_year || ""} onChange={(e) => setForm({ ...form, start_year: Number(e.target.value) || null })} /></div>
        <div className="field"><label>End year</label><input type="number" value={form.end_year || ""} disabled={form.is_current} onChange={(e) => setForm({ ...form, end_year: Number(e.target.value) || null })} /></div>
      </div>
      <label className="checkbox-row"><input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked, end_month: e.target.checked ? null : form.end_month, end_year: e.target.checked ? null : form.end_year })} /> I currently work here</label>
      <div className="profile-entry-actions">
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AddExperienceForm({ onAdded }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
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
    } catch {
      showToast("Could not save experience.", "error");
    } finally {
      setSaving(false);
    }
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
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Experience"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

  function EducationList({ education, setEducation }) {
    const { showToast } = useToast();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);

    async function saveEntry(event, entry, isNew) {
      event.preventDefault();
      const payload = { ...entry };
      if (payload.is_current) payload.end_year = null;
      try {
        const saved = isNew
          ? await addEducation(payload)
          : await updateEducation(entry.id, payload);
        setEducation((items) => isNew
          ? [saved, ...items]
          : items.map((item) => item.id === saved.id ? saved : item));
        setAdding(false);
        setEditingId(null);
        showToast("Education updated.", "success");
      } catch {
        showToast("Could not save education.", "error");
      }
    }

    async function removeEntry(id) {
      try {
        await deleteEducation(id);
        setEducation((items) => items.filter((item) => item.id !== id));
      } catch {
        showToast("Could not remove education.", "error");
      }
    }

    return (
      <div className="profile-entry-list">
        {education.length === 0 && <p className="muted text-sm">Add schools, universities, or training programs.</p>}
        {education.map((entry) => (
          <div key={entry.id} className="profile-entry">
            {editingId === entry.id ? (
              <EducationForm initial={entry} onSubmit={(event, value) => saveEntry(event, value, false)} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <div>
                  <strong>{entry.degree || entry.field_of_study || "Education"}</strong>
                  <p className="muted text-sm">{entry.institution}{entry.field_of_study && entry.degree ? ` · ${entry.field_of_study}` : ""}</p>
                  <p className="text-xs muted">
                    {entry.start_year || "Start year not set"} – {entry.is_current ? "Present" : entry.end_year || "End year not set"}
                  </p>
                  {entry.description && <p className="text-sm muted profile-entry-description">{entry.description}</p>}
                </div>
                <div className="profile-entry-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(entry.id)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeEntry(entry.id)}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <EducationForm onSubmit={(event, value) => saveEntry(event, value, true)} onCancel={() => setAdding(false)} />
        ) : (
          <button className="btn btn-outline btn-sm profile-add-entry" onClick={() => setAdding(true)}>+ Add education</button>
        )}
      </div>
    );
  }

  function EducationForm({ initial, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial || {
      institution: "",
      institution_url: "",
      degree: "",
      field_of_study: "",
      start_year: "",
      end_year: "",
      is_current: false,
      description: "",
    });

    return (
      <form className="profile-entry-form" onSubmit={(event) => onSubmit(event, form)}>
        <div className="field"><label>School or institution</label><input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} required /></div>
        <div className="field"><label>School or institution website</label><input type="url" value={form.institution_url || ""} onChange={(e) => setForm({ ...form, institution_url: e.target.value })} placeholder="https://school.edu" /></div>
        <div className="field-row">
          <div className="field"><label>Degree or qualification</label><input value={form.degree || ""} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></div>
          <div className="field"><label>Field of study</label><input value={form.field_of_study || ""} onChange={(e) => setForm({ ...form, field_of_study: e.target.value })} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Start year</label><input type="number" min="1900" max="2100" value={form.start_year || ""} onChange={(e) => setForm({ ...form, start_year: Number(e.target.value) || null })} /></div>
          <div className="field"><label>End year</label><input type="number" min="1900" max="2100" value={form.end_year || ""} disabled={form.is_current} onChange={(e) => setForm({ ...form, end_year: Number(e.target.value) || null })} /></div>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked, end_year: e.target.checked ? null : form.end_year })} /> I currently study here</label>
        <div className="field"><label>Details</label><textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="profile-entry-actions">
          <button className="btn btn-primary btn-sm" type="submit">Save education</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    );
  }

  function AchievementList({ achievements, setAchievements }) {
    const { showToast } = useToast();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);

    async function saveEntry(event, entry, isNew) {
      event.preventDefault();
      try {
        const saved = isNew
          ? await addAchievement(entry)
          : await updateAchievement(entry.id, entry);
        setAchievements((items) => isNew
          ? [saved, ...items]
          : items.map((item) => item.id === saved.id ? saved : item));
        setAdding(false);
        setEditingId(null);
        showToast("Achievement updated.", "success");
      } catch {
        showToast("Could not save achievement.", "error");
      }
    }

    async function removeEntry(id) {
      try {
        await deleteAchievement(id);
        setAchievements((items) => items.filter((item) => item.id !== id));
      } catch {
        showToast("Could not remove achievement.", "error");
      }
    }

    return (
      <div className="profile-entry-list">
        {achievements.length === 0 && <p className="muted text-sm">Add certifications, awards, projects, or other professional accomplishments.</p>}
        {achievements.map((entry) => (
          <div key={entry.id} className="profile-entry">
            {editingId === entry.id ? (
              <AchievementForm initial={entry} onSubmit={(event, value) => saveEntry(event, value, false)} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <div>
                  <strong>{entry.title}</strong>
                  {entry.issuer && <p className="muted text-sm">{entry.issuer}</p>}
                  {entry.year && <p className="text-xs muted">{entry.year}</p>}
                  {entry.description && <p className="text-sm muted profile-entry-description">{entry.description}</p>}
                  {entry.credential_url && <a className="text-sm profile-credential-link" href={entry.credential_url} target="_blank" rel="noreferrer">View credential</a>}
                </div>
                <div className="profile-entry-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(entry.id)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeEntry(entry.id)}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <AchievementForm onSubmit={(event, value) => saveEntry(event, value, true)} onCancel={() => setAdding(false)} />
        ) : (
          <button className="btn btn-outline btn-sm profile-add-entry" onClick={() => setAdding(true)}>+ Add achievement</button>
        )}
      </div>
    );
  }

  function AchievementForm({ initial, onSubmit, onCancel }) {
    const [form, setForm] = useState(initial || {
      title: "",
      issuer: "",
      year: "",
      description: "",
      credential_url: "",
    });

    return (
      <form className="profile-entry-form" onSubmit={(event) => onSubmit(event, form)}>
        <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="field-row">
          <div className="field"><label>Issuer</label><input value={form.issuer || ""} onChange={(e) => setForm({ ...form, issuer: e.target.value })} /></div>
          <div className="field"><label>Year</label><input type="number" min="1900" max="2100" value={form.year || ""} onChange={(e) => setForm({ ...form, year: Number(e.target.value) || null })} /></div>
        </div>
        <div className="field"><label>Description</label><textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Credential URL</label><input type="url" value={form.credential_url || ""} onChange={(e) => setForm({ ...form, credential_url: e.target.value })} /></div>
        <div className="profile-entry-actions">
          <button className="btn btn-primary btn-sm" type="submit">Save achievement</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    );
  }

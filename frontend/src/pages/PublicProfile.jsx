import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicProfile } from "../api/auth";
import {
  myConnections,
  respondConnectionRequest,
  sendConnectionRequest,
  withdrawConnectionRequest,
} from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PublicProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectSent, setConnectSent] = useState(false);
  const [connection, setConnection] = useState(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const { profile: me } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      try {
        const [profileData, connectionData] = await Promise.all([
          getPublicProfile(userId),
          myConnections(),
        ]);
        if (!active) return;
        setProfile(profileData);
        const all = [
          ...(connectionData.connections || []),
          ...(connectionData.pending_sent || []),
          ...(connectionData.pending_received || []),
        ];
        const current = all.find((item) =>
          item.from_user === Number(userId) || item.to_user === Number(userId)
        );
        setConnection(current || null);
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [userId]);

  async function handleConnect() {
    setConnectionBusy(true);
    try {
      const request = await sendConnectionRequest(userId);
      setConnection(request);
      setConnectSent(true);
      showToast("Connection request sent.", "success");
    } catch {
      showToast("Could not send request.", "error");
    } finally {
      setConnectionBusy(false);
    }
  }

  async function handleWithdraw() {
    if (!connection) return;
    setConnectionBusy(true);
    try {
      await withdrawConnectionRequest(connection.id);
      setConnection(null);
      setConnectSent(false);
      showToast("Connection request withdrawn.", "success");
    } catch {
      showToast("Could not withdraw request.", "error");
    } finally {
      setConnectionBusy(false);
    }
  }

  async function handleRespond(action) {
    if (!connection) return;
    setConnectionBusy(true);
    try {
      const updated = await respondConnectionRequest(connection.id, action);
      setConnection(updated);
      showToast(action === "accept" ? "Connection accepted." : "Request declined.", "success");
    } catch {
      showToast("Could not respond to connection request.", "error");
    } finally {
      setConnectionBusy(false);
    }
  }

  if (loading) return <div className="container page"><div className="spinner" /></div>;
  if (!profile) return <div className="container page"><p>Profile not found.</p></div>;

  const isMe = me?.user_id === profile.user_id;

  return (
    <div className="page container profile-page">
      <div className="card profile-header-card">
        <div className="profile-avatar-row">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="profile-avatar-lg" />
          ) : (
            <div className="profile-avatar-lg profile-avatar-fallback">{profile.full_name[0].toUpperCase()}</div>
          )}
          <div>
            <h1>{profile.full_name}</h1>
            <p className="muted">{profile.headline || "—"}</p>
            <p className="text-sm muted">
              {[profile.industry, profile.location].filter(Boolean).join(" · ") || "Professional member"}
            </p>
            {profile.company_name && <p className="text-sm muted">{profile.company_name}</p>}
            {profile.company_website && (
              <a className="text-sm profile-credential-link" href={profile.company_website} target="_blank" rel="noreferrer">
                Company website
              </a>
            )}
          </div>
          {!isMe && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {connection?.status === "accepted" ? (
                <Link to={`/messages?to=${profile.user_id}`} className="btn btn-outline btn-sm">Message</Link>
              ) : connection?.status === "pending" && connection.from_user === me?.user_id ? (
                <button className="btn btn-outline btn-sm" onClick={handleWithdraw} disabled={connectionBusy}>
                  {connectionBusy ? "Please wait..." : "Withdraw request"}
                </button>
              ) : connection?.status === "pending" ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => handleRespond("accept")} disabled={connectionBusy}>Accept</button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleRespond("decline")} disabled={connectionBusy}>Decline</button>
                </>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleConnect} disabled={connectionBusy || connectSent}>
                  {connectionBusy ? "Sending..." : connectSent ? "Request sent" : "Connect"}
                </button>
              )}
            </div>
          )}
          {isMe && (
            <Link to="/profile/edit" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
              Edit profile
            </Link>
          )}
        </div>
      </div>

      <div className="profile-grid">
        <div className="card profile-form">
          <h3>About</h3>
          <p className="text-sm">{profile.bio || "No bio yet."}</p>

          {profile.skills && (
            <>
              <h4 style={{ marginTop: 18 }}>Skills</h4>
              <div className="skill-chip-row">
                {profile.skills.split(",").map((s, i) => <span key={i} className="tag">{s.trim()}</span>)}
              </div>
            </>
          )}
        </div>

        <div className="card profile-side">
          <h3>Experience</h3>
          {profile.experiences.length === 0 ? (
            <p className="muted text-sm">No experience listed.</p>
          ) : (
            <div className="experience-list">
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="experience-item">
                  <div>
                    <strong>{exp.job_title}</strong>
                    <p className="muted text-sm">{exp.company}</p>
                    <p className="text-sm muted">
                      {MONTHS[(exp.start_month || 1) - 1]} {exp.start_year} – {exp.is_current ? "Present" : `${MONTHS[(exp.end_month || 1) - 1]} ${exp.end_year}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card profile-side">
          <h3>Education</h3>
          {!profile.education?.length ? (
            <p className="muted text-sm">No education listed.</p>
          ) : (
            <div className="experience-list">
              {profile.education.map((entry) => (
                <div key={entry.id} className="experience-item">
                  <strong>{entry.degree || entry.field_of_study || "Education"}</strong>
                  <p className="muted text-sm">{entry.institution}</p>
                  {entry.institution_url && (
                    <a href={entry.institution_url} target="_blank" rel="noreferrer" className="text-sm">
                      Institution website
                    </a>
                  )}
                  {entry.degree && entry.field_of_study && <p className="text-sm muted">{entry.field_of_study}</p>}
                  <p className="text-sm muted">
                    {entry.start_year || "—"} – {entry.is_current ? "Present" : entry.end_year || "—"}
                  </p>
                  {entry.description && <p className="text-sm muted">{entry.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card profile-side">
          <h3>Achievements & Certifications</h3>
          {!profile.achievements?.length ? (
            <p className="muted text-sm">No achievements listed.</p>
          ) : (
            <div className="experience-list">
              {profile.achievements.map((entry) => (
                <div key={entry.id} className="experience-item">
                  <strong>{entry.title}</strong>
                  {entry.issuer && <p className="muted text-sm">{entry.issuer}</p>}
                  {entry.year && <p className="text-sm muted">{entry.year}</p>}
                  {entry.description && <p className="text-sm muted">{entry.description}</p>}
                  {entry.credential_url && <a className="text-sm profile-credential-link" href={entry.credential_url} target="_blank" rel="noreferrer">View credential</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

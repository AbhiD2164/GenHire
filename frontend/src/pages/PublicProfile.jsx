import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicProfile } from "../api/auth";
import { sendConnectionRequest } from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PublicProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectSent, setConnectSent] = useState(false);
  const { profile: me } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    getPublicProfile(userId).then(setProfile).finally(() => setLoading(false));
  }, [userId]);

  async function handleConnect() {
    try {
      await sendConnectionRequest(userId);
      setConnectSent(true);
      showToast("Connection request sent.", "success");
    } catch {
      showToast("Could not send request.", "error");
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
            <p className="text-sm muted">{profile.location}</p>
          </div>
          {!isMe && (
            <button className="btn btn-amber" style={{ marginLeft: "auto" }} onClick={handleConnect} disabled={connectSent}>
              {connectSent ? "Request sent" : "Connect"}
            </button>
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
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { searchCandidates } from "../api/auth";
import { sendConnectionRequest } from "../api/network";
import { useToast } from "../context/ToastContext";

export default function CandidateSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState("");
  const [location, setLocation] = useState("");
  const [minExp, setMinExp] = useState("");
  const { showToast } = useToast();

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (skill) params.skill = skill;
      if (location) params.location = location;
      if (minExp) params.min_experience_years = minExp;
      const data = await searchCandidates(params);
      setResults(data.results || data);
    } finally {
      setLoading(false);
    }
  }, [skill, location, minExp]);

  useEffect(() => {
    const t = setTimeout(fetchResults, 350);
    return () => clearTimeout(t);
  }, [fetchResults]);

  async function handleConnect(userId) {
    try {
      await sendConnectionRequest(userId);
      showToast("Connection request sent.", "success");
    } catch {
      showToast("Could not send request.", "error");
    }
  }

  return (
    <div className="page container">
      <span className="eyebrow">Talent search</span>
      <h1>Find candidates</h1>
      <p className="muted">Search across any role or industry — not just tech.</p>

      <div className="filter-bar card">
        <input placeholder="Skill, e.g. welding, SEO, nursing…" value={skill} onChange={(e) => setSkill(e.target.value)} />
        <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input type="number" min="0" placeholder="Min years experience" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h3>No candidates match yet</h3>
          <p>Try broadening your search.</p>
        </div>
      ) : (
        <div className="candidate-grid">
          {results.map((c) => (
            <div key={c.id} className="card candidate-card">
              <Link to={`/profile/${c.id}`} className="nav-avatar-fallback candidate-avatar">
                {(c.first_name || c.username)[0].toUpperCase()}
              </Link>
              <div>
                <Link to={`/profile/${c.id}`}><strong>{c.first_name} {c.last_name}</strong></Link>
                <p className="text-sm muted">{c.headline || "No headline"}</p>
                <p className="text-sm muted">📍 {c.location || "Unknown location"}</p>
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={() => handleConnect(c.id)}>
                Connect
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

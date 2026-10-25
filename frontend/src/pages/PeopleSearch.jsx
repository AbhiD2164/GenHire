import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { searchPeople } from "../api/auth";
import {
  myConnections,
  respondConnectionRequest,
  sendConnectionRequest,
  withdrawConnectionRequest,
} from "../api/network";
import { useToast } from "../context/ToastContext";

export default function PeopleSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState("");
  const [location, setLocation] = useState("");
  const [minExp, setMinExp] = useState("");
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [acceptedConnections, setAcceptedConnections] = useState([]);
  const { showToast } = useToast();

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (skill) params.skill = skill;
      if (location) params.location = location;
      if (minExp) params.min_experience_years = minExp;
      const [data, connectionData] = await Promise.all([
        searchPeople(params),
        myConnections().catch(() => ({ connections: [], pending_sent: [], pending_received: [] })),
      ]);
      setResults(data.results || data);
      setConnectionRequests(connectionData.pending_sent || []);
      setIncomingRequests(connectionData.pending_received || []);
      setAcceptedConnections(connectionData.connections || []);
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
      const request = await sendConnectionRequest(userId);
      setConnectionRequests((requests) => [...requests.filter((item) => item.id !== request.id), request]);
      showToast("Connection request sent.", "success");
    } catch {
      showToast("Could not send request.", "error");
    }
  }

  async function handleWithdraw(connectionId) {
    try {
      await withdrawConnectionRequest(connectionId);
      setConnectionRequests((requests) => requests.filter((item) => item.id !== connectionId));
      showToast("Connection request withdrawn.", "success");
    } catch {
      showToast("Could not withdraw request.", "error");
    }
  }

  async function handleRespond(connectionId, action) {
    try {
      await respondConnectionRequest(connectionId, action);
      setIncomingRequests((requests) => requests.filter((request) => request.id !== connectionId));
      showToast(action === "accept" ? "Connection accepted." : "Request declined.", "success");
    } catch {
      showToast("Could not respond to connection request.", "error");
    }
  }

  return (
    <div className="page container">
      <span className="eyebrow">People search</span>
      <h1>Find people</h1>
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
          <h3>No people match this search yet</h3>
          <p>Try broadening your search.</p>
        </div>
      ) : (
        <div className="candidate-grid">
          {results.map((c) => {
            const request = connectionRequests.find((item) => item.to_user === c.id);
            const incoming = incomingRequests.find((item) => item.from_user === c.id);
            const connected = acceptedConnections.some((item) =>
              item.from_user === c.id || item.to_user === c.id
            );
            return (
              <div key={c.id} className="card candidate-card">
                <Link to={`/profile/${c.id}`} className="nav-avatar-fallback candidate-avatar">
                  {(c.first_name || c.username)[0].toUpperCase()}
                </Link>
                <div>
                  <Link to={`/profile/${c.id}`}><strong>{c.first_name} {c.last_name}</strong></Link>
                  <p className="text-sm muted">{c.headline || "No headline"}</p>
                  <p className="text-sm muted">📍 {c.location || "Unknown location"}</p>
                </div>
                {connected ? (
                  <Link className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} to={`/messages?to=${c.id}`}>
                    Message
                  </Link>
                ) : incoming ? (
                  <div className="connection-request-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleRespond(incoming.id, "accept")}>Accept</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleRespond(incoming.id, "decline")}>Decline</button>
                  </div>
                ) : request ? (
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={() => handleWithdraw(request.id)}>
                    Withdraw request
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => handleConnect(c.id)}>
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

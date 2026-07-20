import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { myConnections, respondConnectionRequest } from "../api/network";
import { useToast } from "../context/ToastContext";

export default function Network() {
  const [data, setData] = useState({ connections: [], pending_received: [], pending_sent: [] });
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await myConnections());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleRespond(id, action) {
    await respondConnectionRequest(id, action);
    showToast(action === "accept" ? "Connection accepted." : "Request declined.", "success");
    fetchData();
  }

  if (loading) return <div className="container page"><div className="spinner" /></div>;

  return (
    <div className="page container">
      <span className="eyebrow">Your network</span>
      <h1>Connections</h1>

      {data.pending_received.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3>Pending requests</h3>
          <div className="connection-list">
            {data.pending_received.map((c) => (
              <div key={c.id} className="card connection-row">
                <div>
                  <strong>{c.from_user_name}</strong>
                  <p className="text-sm muted">{c.from_user_headline}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-amber btn-sm" onClick={() => handleRespond(c.id, "accept")}>Accept</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRespond(c.id, "decline")}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h3>Your connections ({data.connections.length})</h3>
        {data.connections.length === 0 ? (
          <div className="empty-state">
            <h3>No connections yet</h3>
            <p>Visit profiles in the feed or candidate search to start connecting.</p>
          </div>
        ) : (
          <div className="connection-list">
            {data.connections.map((c) => {
              const other = c.from_user_name === undefined ? c : c;
              return (
                <div key={c.id} className="card connection-row">
                  <div>
                    <strong>{c.from_user_name}</strong> ↔ <strong>{c.to_user_name}</strong>
                    <p className="text-sm muted">Connected</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {data.pending_sent.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3>Sent requests awaiting response</h3>
          <div className="connection-list">
            {data.pending_sent.map((c) => (
              <div key={c.id} className="card connection-row">
                <div>
                  <strong>{c.to_user_name}</strong>
                  <p className="text-sm muted">{c.to_user_headline}</p>
                </div>
                <span className="status-pill status-pending">Pending</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

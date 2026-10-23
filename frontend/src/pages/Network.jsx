import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  myConnections,
  respondConnectionRequest,
  sendConnectionRequest,
  getSuggestedPeople,
  getCommunities,
  createCommunity,
  toggleCommunityMembership,
} from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Network() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [connectionData, setConnectionData] = useState({ connections: [], pending_received: [], pending_sent: [] });
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Community creation modal/form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComm, setNewComm] = useState({ name: "", description: "", community_type: "opensource" });
  const [submittingComm, setSubmittingComm] = useState(false);

  // Active section view
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'connections', 'communities'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, suggestionsRes, commRes] = await Promise.all([
        myConnections(),
        getSuggestedPeople().catch(() => []),
        getCommunities().catch(() => []),
      ]);
      setConnectionData(connRes);
      setSuggestedPeople(suggestionsRes || []);
      setCommunities(commRes || []);
    } catch (err) {
      console.error(err);
      showToast("Failed to load network data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRespond(id, action) {
    try {
      await respondConnectionRequest(id, action);
      showToast(action === "accept" ? "Connection accepted!" : "Request declined.", "success");
      fetchData();
    } catch {
      showToast("Action failed. Try again.", "error");
    }
  }

  async function handleConnect(userId) {
    try {
      await sendConnectionRequest(userId);
      showToast("Connection invitation sent!", "success");
      setSuggestedPeople((prev) => prev.filter((p) => p.id !== userId));
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not send invitation.", "error");
    }
  }

  async function handleToggleCommunity(commId) {
    try {
      const res = await toggleCommunityMembership(commId);
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === commId ? { ...c, is_member: res.joined, members_count: res.members_count } : c
        )
      );
      showToast(res.joined ? "Joined community!" : "Left community.", "success");
    } catch {
      showToast("Unable to update community membership.", "error");
    }
  }

  async function handleCreateCommunity(e) {
    e.preventDefault();
    if (!newComm.name.trim()) return;
    setSubmittingComm(true);
    try {
      const created = await createCommunity(newComm);
      setCommunities((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewComm({ name: "", description: "", community_type: "opensource" });
      showToast("Community successfully created!", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not create community.", "error");
    } finally {
      setSubmittingComm(false);
    }
  }

  if (loading) {
    return (
      <div className="container page" style={{ textAlign: "center", paddingTop: 80 }}>
        <div className="spinner" />
        <p className="muted" style={{ marginTop: 16 }}>Loading your professional network...</p>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="network-layout">
        {/* Left Manage Sidebar */}
        <aside className="network-sidebar-card">
          <h4>Manage my network</h4>
          <div
            className={`network-nav-item ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>Overview & Suggestions</span>
          </div>
          <div
            className={`network-nav-item ${activeTab === "connections" ? "active" : ""}`}
            onClick={() => setActiveTab("connections")}
          >
            <span>Connections</span>
            <span className="network-nav-badge">{connectionData.connections.length}</span>
          </div>
          <div
            className={`network-nav-item ${activeTab === "communities" ? "active" : ""}`}
            onClick={() => setActiveTab("communities")}
          >
            <span>Groups & Open-Source</span>
            <span className="network-nav-badge">{communities.length}</span>
          </div>
          {connectionData.pending_received.length > 0 && (
            <div className="network-nav-item" onClick={() => setActiveTab("all")}>
              <span>Pending Invitations</span>
              <span className="badge" style={{ background: "var(--brand-strong)", color: "#fff" }}>
                {connectionData.pending_received.length}
              </span>
            </div>
          )}
        </aside>

        {/* Main Center Area */}
        <main style={{ minWidth: 0 }}>
          {/* Pending Invitations Banner */}
          {connectionData.pending_received.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  Invitations ({connectionData.pending_received.length})
                </h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {connectionData.pending_received.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 15 }}>{c.from_user_name}</strong>
                      <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                        {c.from_user_headline || "GenHire Professional"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRespond(c.id, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRespond(c.id, "decline")}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communities & Open-Source Groups */}
          {(activeTab === "all" || activeTab === "communities") && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Open-Source Communities & Groups</h3>
                  <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                    Collaborate on open projects, share domain expertise, and chat with team groups
                  </p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCreateModal(!showCreateModal)}
                >
                  {showCreateModal ? "Cancel" : "+ Create Community"}
                </button>
              </div>

              {/* Create Community Form */}
              {showCreateModal && (
                <form
                  onSubmit={handleCreateCommunity}
                  style={{
                    background: "#F8FAFC",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Create New Community / Group</h4>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="text-sm font-semibold">Community Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Open Healthcare ML, React Engineers, FinTech Innovators"
                      value={newComm.name}
                      onChange={(e) => setNewComm({ ...newComm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="text-sm font-semibold">Community Type</label>
                    <select
                      className="input"
                      value={newComm.community_type}
                      onChange={(e) => setNewComm({ ...newComm, community_type: e.target.value })}
                    >
                      <option value="opensource">Open-Source Project</option>
                      <option value="public">Public Community</option>
                      <option value="private">Private Group</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="text-sm font-semibold">Description</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="What is this community working on?"
                      value={newComm.description}
                      onChange={(e) => setNewComm({ ...newComm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingComm}>
                    {submittingComm ? "Creating..." : "Launch Community"}
                  </button>
                </form>
              )}

              {/* Community List */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {communities.length === 0 ? (
                  <p className="muted text-sm">No communities yet. Be the first to launch one!</p>
                ) : (
                  communities.map((comm) => (
                    <div key={comm.id} className="community-row">
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div className="community-icon">
                          {comm.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="community-meta-title">
                            {comm.name}
                            <span
                              className={`community-pill ${
                                comm.community_type === "opensource"
                                  ? "opensource"
                                  : comm.community_type === "private"
                                  ? "private"
                                  : "public"
                              }`}
                            >
                              {comm.community_type === "opensource"
                                ? "Open Source"
                                : comm.community_type}
                            </span>
                          </div>
                          <p className="community-meta-desc">
                            {comm.description || "Active professional discussion group"}
                          </p>
                          <span className="text-xs muted">
                            {comm.members_count || 1} members
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className={`btn btn-sm ${comm.is_member ? "btn-outline" : "btn-primary"}`}
                          onClick={() => handleToggleCommunity(comm.id)}
                        >
                          {comm.is_member ? "Joined" : "Join"}
                        </button>
                        <Link
                          to={`/messages?community=${comm.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Group Chat
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* People You May Know Grid */}
          {(activeTab === "all" || activeTab === "connections") && suggestedPeople.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>People you may know based on your profile</h3>
              <p className="text-sm muted" style={{ margin: "0 0 16px" }}>
                Connect with professionals across healthcare, engineering, finance, and management
              </p>
              <div className="network-people-grid">
                {suggestedPeople.map((person) => {
                  const initial = (person.first_name || person.username || "U").charAt(0).toUpperCase();
                  const displayName =
                    person.first_name && person.last_name
                      ? `${person.first_name} ${person.last_name}`
                      : person.username;

                  return (
                    <div key={person.id} className="person-card">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt={displayName}
                          className="person-card-avatar"
                        />
                      ) : (
                        <div className="person-card-avatar">{initial}</div>
                      )}
                      <h4 className="person-card-name" title={displayName}>
                        {displayName}
                      </h4>
                      <p className="person-card-headline" title={person.headline}>
                        {person.headline || `${person.role === "recruiter" ? "Recruiter" : "Professional"}`}
                      </p>
                      <div className="person-card-meta">
                        {person.industry || person.location || "GenHire Network"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", marginTop: "auto" }}>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ width: "100%" }}
                          onClick={() => handleConnect(person.id)}
                        >
                          + Connect
                        </button>
                        <Link
                          to={`/profile/${person.id}`}
                          className="btn btn-ghost btn-sm text-xs"
                          style={{ width: "100%", padding: "4px" }}
                        >
                          View Profile
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Existing Connected Members */}
          {(activeTab === "all" || activeTab === "connections") && (
            <div className="card">
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                Your Connections ({connectionData.connections.length})
              </h3>
              <p className="text-sm muted" style={{ margin: "0 0 16px" }}>
                Directly message your 1st-degree connections
              </p>

              {connectionData.connections.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 0" }}>
                  <p className="muted">You don't have any established connections yet.</p>
                  <p className="text-sm muted">Send connection requests above to start building your network!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {connectionData.connections.map((c) => {
                    const partnerId = c.from_user === profile?.user_id ? c.to_user : c.from_user;
                    const partnerName = c.from_user === profile?.user_id ? c.to_user_name : c.from_user_name;
                    const partnerHeadline = c.from_user === profile?.user_id ? c.to_user_headline : c.from_user_headline;

                    return (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "#F8FAFC",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 14 }}>{partnerName}</strong>
                          <p className="text-xs muted" style={{ margin: "2px 0 0" }}>
                            {partnerHeadline || "Connected Member"}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Link to={`/messages?to=${partnerId}`} className="btn btn-primary btn-sm">
                            Message
                          </Link>
                          <Link to={`/profile/${partnerId}`} className="btn btn-ghost btn-sm">
                            Profile
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sent Pending Requests */}
          {connectionData.pending_sent.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>
                Sent requests awaiting response ({connectionData.pending_sent.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {connectionData.pending_sent.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "#F8FAFC",
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13.5 }}>{c.to_user_name}</strong>
                      <p className="text-xs muted" style={{ margin: 0 }}>{c.to_user_headline}</p>
                    </div>
                    <span className="badge" style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11 }}>
                      Pending Response
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

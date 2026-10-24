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
import { searchCandidates } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const CURATED_FEATURED_PEOPLE = [
  {
    id: "featured-1",
    displayName: "Dr. Sarah Mitchell",
    username: "sarah_mitchell",
    headline: "Chief Clinical Informatics Officer • Healthcare AI",
    industry: "Healthcare & Life Sciences",
    avatar: null,
    initial: "S",
    isCurated: true,
  },
  {
    id: "featured-2",
    displayName: "Alexander Vance",
    username: "avance_tech",
    headline: "Principal Distributed Systems Engineer • Cloud Platforms",
    industry: "Software & Technology",
    avatar: null,
    initial: "A",
    isCurated: true,
  },
  {
    id: "featured-3",
    displayName: "Priya Sundaram",
    username: "priya_fintech",
    headline: "VP of Quantitative Risk & Algorithmic Trading",
    industry: "Financial Services",
    avatar: null,
    initial: "P",
    isCurated: true,
  },
  {
    id: "featured-4",
    displayName: "Elena Rostova",
    username: "elena_design",
    headline: "Head of Product Design & Human-Centered Systems",
    industry: "Design & UX",
    avatar: null,
    initial: "E",
    isCurated: true,
  },
];

const CURATED_DEFAULT_COMMUNITIES = [
  {
    id: 1,
    name: "Open Source AI & ML Innovators",
    community_type: "open_source",
    description: "Collaborative research and engineering on open-source transformer models and data architectures.",
    members_count: 1420,
    isCurated: false,
  },
  {
    id: 2,
    name: "Cloud Architecture & High-Scale Systems",
    community_type: "public_group",
    description: "Enterprise backend engineers, SREs, and DevOps professionals discussing high-availability patterns.",
    members_count: 980,
    isCurated: false,
  },
  {
    id: 3,
    name: "Healthcare Informatics & BioTech",
    community_type: "public_group",
    description: "Clinical researchers, health data scientists, and digital health software builders.",
    members_count: 640,
    isCurated: false,
  },
];

export default function Network() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [connectionData, setConnectionData] = useState({ connections: [], pending_received: [], pending_sent: [] });
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState(new Set());

  // Community creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComm, setNewComm] = useState({ name: "", description: "", community_type: "opensource" });
  const [submittingComm, setSubmittingComm] = useState(false);

  // Active section view
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'connections', 'communities'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, suggestionsRes, commRes, candidatesRes] = await Promise.all([
        myConnections().catch(() => ({ connections: [], pending_received: [], pending_sent: [] })),
        getSuggestedPeople().catch(() => []),
        getCommunities().catch(() => []),
        searchCandidates({}).catch(() => []),
      ]);

      setConnectionData(connRes || { connections: [], pending_received: [], pending_sent: [] });

      const realSuggestions = suggestionsRes || [];
      const platformCandidates = (candidatesRes.results || candidatesRes || []).filter(
        (c) => c.id !== profile?.user_id
      );

      const merged = [...realSuggestions];
      platformCandidates.forEach((cand) => {
        if (!merged.some((m) => m.id === cand.id)) {
          merged.push(cand);
        }
      });

      setSuggestedPeople(merged);
      setCommunities(commRes || []);
    } catch (err) {
      console.error(err);
      showToast("Unable to refresh network suggestions.", "error");
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id, showToast]);

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

  async function handleConnect(userId, isCurated = false) {
    if (isCurated) {
      setSentRequests((prev) => new Set(prev).add(userId));
      showToast("Connection invitation sent!", "success");
      return;
    }
    try {
      await sendConnectionRequest(userId);
      setSentRequests((prev) => new Set(prev).add(userId));
      showToast("Connection invitation sent!", "success");
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not send invitation.", "error");
    }
  }

  async function handleToggleCommunity(commId, isCurated = false) {
    if (isCurated) {
      showToast("Joined community channel!", "success");
      return;
    }
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
      showToast("Community successfully launched!", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not create community.", "error");
    } finally {
      setSubmittingComm(false);
    }
  }

  // Filter suggested people by search query if typed
  const displayedPeople = (
    suggestedPeople.length > 0
      ? suggestedPeople.map((p) => ({
          id: p.id,
          displayName: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username,
          username: p.username,
          headline: p.headline || p.role || "GenHire Professional",
          industry: p.industry || p.location || "Professional Member",
          avatar: p.avatar,
          initial: (p.first_name || p.username || "U").charAt(0).toUpperCase(),
          isCurated: false,
        }))
      : CURATED_FEATURED_PEOPLE
  ).filter((p) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.headline.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q)
    );
  });

  const displayedCommunities = communities.length > 0 ? communities : CURATED_DEFAULT_COMMUNITIES;

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
            <span>Communities & Groups</span>
            <span className="network-nav-badge">{displayedCommunities.length}</span>
          </div>
          {connectionData.pending_received.length > 0 && (
            <div className="network-nav-item" onClick={() => setActiveTab("all")}>
              <span>Pending Invitations</span>
              <span className="badge" style={{ background: "var(--brand-strong)", color: "#fff" }}>
                {connectionData.pending_received.length}
              </span>
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <Link to="/messages" className="btn btn-outline btn-sm" style={{ width: "100%", textAlign: "center" }}>
              💬 Open Messenger
            </Link>
          </div>
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

          {/* Communities & Groups */}
          {(activeTab === "all" || activeTab === "communities") && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Communities & Knowledge Groups</h3>
                  <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                    Collaborate on projects, share domain expertise, and participate in open discussions
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
                      placeholder="e.g. Healthcare Analytics, Cloud Engineering, FinTech Circle"
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
                      placeholder="What is this community collaborating on?"
                      value={newComm.description}
                      onChange={(e) => setNewComm({ ...newComm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingComm}>
                    {submittingComm ? "Launching..." : "Launch Community"}
                  </button>
                </form>
              )}

              {/* Community List */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {displayedCommunities.map((comm) => (
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
                            {comm.community_type === "opensource" ? "Open Source" : comm.community_type}
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
                        onClick={() => handleToggleCommunity(comm.id, comm.isCurated)}
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
                ))}
              </div>
            </div>
          )}

          {/* People You May Know Grid */}
          {(activeTab === "all" || activeTab === "connections") && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 16 }}>People you may know</h3>
                  <p className="text-sm muted" style={{ margin: 0 }}>
                    Expand your professional network across engineering, healthcare, finance, and management
                  </p>
                </div>
                <div style={{ minWidth: 200 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by name or field..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    style={{ fontSize: 13, padding: "6px 12px" }}
                  />
                </div>
              </div>

              {displayedPeople.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px 0" }}>
                  <p className="muted text-sm">No members match '{memberSearchQuery}'.</p>
                </div>
              ) : (
                <div className="network-people-grid">
                  {displayedPeople.map((person) => {
                    const isConnected = sentRequests.has(person.id);

                    return (
                      <div key={person.id} className="person-card">
                        {person.avatar ? (
                          <img
                            src={person.avatar}
                            alt={person.displayName}
                            className="person-card-avatar"
                          />
                        ) : (
                          <div className="person-card-avatar">{person.initial}</div>
                        )}
                        <h4 className="person-card-name" title={person.displayName}>
                          {person.displayName}
                        </h4>
                        <p className="person-card-headline" title={person.headline}>
                          {person.headline}
                        </p>
                        <div className="person-card-meta">
                          {person.industry}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", marginTop: "auto" }}>
                          <button
                            className={`btn btn-sm ${isConnected ? "btn-outline" : "btn-primary"}`}
                            style={{ width: "100%" }}
                            onClick={() => handleConnect(person.id, person.isCurated)}
                            disabled={isConnected}
                          >
                            {isConnected ? "Invitation Sent" : "+ Connect"}
                          </button>
                          {!person.isCurated && (
                            <Link
                              to={`/profile/${person.id}`}
                              className="btn btn-ghost btn-sm text-xs"
                              style={{ width: "100%", padding: "4px" }}
                            >
                              View Profile
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Existing Connected Members */}
          {(activeTab === "all" || activeTab === "connections") && (
            <div className="card">
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                Your Connections ({connectionData.connections.length})
              </h3>
              <p className="text-sm muted" style={{ margin: "0 0 16px" }}>
                Directly communicate with your professional circle
              </p>

              {connectionData.connections.length === 0 ? (
                <div className="empty-state" style={{ padding: "32px 0", textAlign: "center" }}>
                  <p className="muted" style={{ fontWeight: 600 }}>You haven't established connections yet.</p>
                  <p className="text-sm muted" style={{ maxWidth: 440, margin: "6px auto 16px" }}>
                    Sending invitations to peers in your domain gives you direct messaging access and ranks their updates higher in your feed.
                  </p>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      const firstPerson = displayedPeople[0];
                      if (firstPerson) handleConnect(firstPerson.id, firstPerson.isCurated);
                    }}
                  >
                    Connect with Featured Professionals Above ↑
                  </button>
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
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.to_user_name}</span>
                    <span className="badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      Pending Acceptance
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

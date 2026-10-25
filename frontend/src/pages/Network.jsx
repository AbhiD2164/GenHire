import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  myConnections,
  respondConnectionRequest,
  sendConnectionRequest,
  withdrawConnectionRequest,
  getSuggestedPeople,
  getCommunities,
  createCommunity,
  updateCommunityMembership,
  getCommunityMembershipRequests,
  respondCommunityMembershipRequest,
  getCommunityInvitations,
  inviteToCommunity,
  respondCommunityInvitation,
} from "../api/network";
import { searchPeople } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Network() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [connectionData, setConnectionData] = useState({ connections: [], pending_received: [], pending_sent: [] });
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [communityInvitations, setCommunityInvitations] = useState([]);
  const [inviteSelections, setInviteSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState(new Set());

  // Community creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComm, setNewComm] = useState({ name: "", description: "", community_type: "public" });
  const [submittingComm, setSubmittingComm] = useState(false);

  // Active section view
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'connections', 'communities'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, suggestionsRes, commRes, peopleRes, membershipRequestsRes, invitationsRes] = await Promise.all([
        myConnections().catch(() => ({ connections: [], pending_received: [], pending_sent: [] })),
        getSuggestedPeople().catch(() => []),
        getCommunities().catch(() => []),
        searchPeople({}).catch(() => []),
        getCommunityMembershipRequests().catch(() => []),
        getCommunityInvitations().catch(() => []),
      ]);

      setConnectionData(connRes || { connections: [], pending_received: [], pending_sent: [] });
      setSentRequests(new Set((connRes?.pending_sent || []).map((c) => c.to_user)));

      const realSuggestions = suggestionsRes || [];
      const platformMembers = (peopleRes.results || peopleRes || []).filter(
        (c) => c.id !== profile?.user_id
      );

      const merged = [...realSuggestions];
      platformMembers.forEach((member) => {
        if (!merged.some((suggestion) => suggestion.id === member.id)) {
          merged.push(member);
        }
      });

      setSuggestedPeople(merged);
      setCommunities(Array.isArray(commRes) ? commRes : commRes?.results || []);
      setMembershipRequests(membershipRequestsRes || []);
      setCommunityInvitations(invitationsRes || []);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const query = communitySearchQuery.trim();
        const results = await getCommunities(query ? { search: query } : {});
        setCommunities(Array.isArray(results) ? results : results?.results || []);
      } catch (error) {
        console.error("Could not search communities.", error);
        showToast("Unable to search communities.", "error");
      }
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [communitySearchQuery, showToast]);

  async function handleRespond(id, action) {
    try {
      await respondConnectionRequest(id, action);
      window.dispatchEvent(new Event("genhire:notifications-updated"));
      showToast(action === "accept" ? "Connection accepted!" : "Request declined.", "success");
      fetchData();
    } catch {
      showToast("Action failed. Try again.", "error");
    }
  }

  async function handleConnect(userId) {
    try {
      const request = await sendConnectionRequest(userId);
      setConnectionData((current) => ({
        ...current,
        pending_sent: [...current.pending_sent.filter((item) => item.id !== request.id), request],
      }));
      setSentRequests((prev) => new Set(prev).add(userId));
      showToast("Connection invitation sent!", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not send invitation.", "error");
    }
  }

  async function handleToggleCommunity(commId) {
    try {
      const comm = communities.find((item) => item.id === commId);
      const action = comm?.is_member ? "leave" : "join";
      const res = await updateCommunityMembership(commId, action);
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === commId ? {
            ...c,
            is_member: res.joined,
            members_count: res.members_count,
            join_request_status: res.join_request_status,
          } : c
        )
      );
      showToast(
        res.joined
          ? "Joined community."
          : res.join_request_status === "pending"
            ? "Join request sent for admin approval."
            : "Left community.",
        "success",
      );
    } catch {
      showToast("Unable to update community membership.", "error");
    }
  }

  async function handleRespondToJoinRequest(requestId, action) {
    try {
      await respondCommunityMembershipRequest(requestId, action);
      window.dispatchEvent(new Event("genhire:notifications-updated"));
      setMembershipRequests((pending) => pending.filter((item) => item.id !== requestId));
      showToast(action === "allow" ? "Member request approved." : "Member request denied.", "success");
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not update join request.", "error");
    }
  }

  async function handleRespondToCommunityInvitation(invitationId, action) {
    try {
      await respondCommunityInvitation(invitationId, action);
      window.dispatchEvent(new Event("genhire:notifications-updated"));
      setCommunityInvitations((items) => items.filter((item) => item.id !== invitationId));
      showToast(
        action === "accept" ? "Community invitation accepted." : "Community invitation declined.",
        "success",
      );
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not respond to the invitation.", "error");
    }
  }

  async function handleInviteToCommunity(communityId) {
    const userId = inviteSelections[communityId];
    if (!userId) {
      showToast("Choose a connection to invite.", "error");
      return;
    }
    try {
      await inviteToCommunity(communityId, userId);
      setInviteSelections((current) => ({ ...current, [communityId]: "" }));
      showToast("Community invitation sent.", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not send the community invitation.", "error");
    }
  }

  async function handleWithdrawConnection(connectionId, userId) {
    try {
      await withdrawConnectionRequest(connectionId);
      setSentRequests((previous) => {
        const next = new Set(previous);
        next.delete(userId);
        return next;
      });
      setConnectionData((current) => ({
        ...current,
        pending_sent: current.pending_sent.filter((item) => item.id !== connectionId),
      }));
      showToast("Connection request withdrawn.", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not withdraw request.", "error");
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
      setNewComm({ name: "", description: "", community_type: "public" });
      showToast("Community successfully launched!", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Could not create community.", "error");
    } finally {
      setSubmittingComm(false);
    }
  }

  // Filter suggested people by search query if typed
  const displayedPeople = suggestedPeople.map((p) => ({
          id: p.id,
          displayName: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username,
          username: p.username,
          headline: p.headline || "GenHire Professional",
          industry: p.industry || p.location || "Professional Member",
          avatar: p.avatar,
          initial: (p.first_name || p.username || "U").charAt(0).toUpperCase(),
        })).filter((p) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.headline.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q)
    );
  });

  const displayedCommunities = communities;

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
            <span>Communities</span>
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

          {membershipRequests.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                Community membership requests ({membershipRequests.length})
              </h3>
              <p className="text-sm muted" style={{ margin: "0 0 14px" }}>
                Review requests to join communities you manage. You can leave requests pending.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {membershipRequests.map((request) => (
                  <div key={request.id} className="community-request-row">
                    <div>
                      <strong>{request.full_name}</strong>
                      <p className="text-xs muted">@{request.username} · {request.community_name}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleRespondToJoinRequest(request.id, "allow")}>
                        Allow
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleRespondToJoinRequest(request.id, "deny")}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {communityInvitations.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>
                Community invitations ({communityInvitations.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {communityInvitations.map((invitation) => (
                  <div key={invitation.id} className="community-request-row">
                    <div>
                      <strong>{invitation.community_name}</strong>
                      <p className="text-xs muted">Invited by {invitation.inviter_name}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleRespondToCommunityInvitation(invitation.id, "accept")}>
                        Accept
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleRespondToCommunityInvitation(invitation.id, "decline")}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Community discovery */}
          {(activeTab === "all" || activeTab === "communities") && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Communities</h3>
                  <p className="text-sm muted" style={{ margin: "2px 0 0" }}>
                    {communitySearchQuery
                      ? "Community search results"
                      : "Recommended for your interests, alongside communities you have joined"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    aria-label="Search communities"
                    placeholder="Search communities..."
                    value={communitySearchQuery}
                    onChange={(event) => setCommunitySearchQuery(event.target.value)}
                    style={{ width: 220 }}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowCreateModal(!showCreateModal)}
                  >
                    {showCreateModal ? "Cancel" : "+ Create Community"}
                  </button>
                </div>
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
                  <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Create a community</h4>
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
                    <label className="text-sm font-semibold">Who can join?</label>
                    <select
                      className="input"
                      value={newComm.community_type}
                      onChange={(e) => setNewComm({ ...newComm, community_type: e.target.value })}
                    >
                      <option value="public">Anyone can join</option>
                      <option value="private">Request admin approval</option>
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
                        </div>
                        <p className="community-meta-desc">
                          {comm.description || "Active professional discussion community"}
                        </p>
                        <span className="text-xs muted">
                          {comm.members_count || 0} members
                          {comm.community_type === "private" ? " · Admin approval required" : ""}
                          {comm.pending_join_requests_count > 0 ? ` · ${comm.pending_join_requests_count} pending requests` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="community-row-actions">
                      {comm.is_member ? (
                        <button className="btn btn-outline btn-sm" onClick={() => handleToggleCommunity(comm.id)}>
                          Leave Community
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleToggleCommunity(comm.id)}
                          disabled={comm.join_request_status === "pending"}
                        >
                          {comm.join_request_status === "pending"
                            ? "Request pending"
                            : comm.community_type === "private"
                              ? "Request to join"
                              : "Join Community"}
                        </button>
                      )}
                      {(comm.is_member || comm.community_type === "public") && (
                        <Link
                          to={`/messages?community=${comm.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Community chat
                        </Link>
                      )}
                      {comm.creator === profile?.user_id && connectionData.connections.length > 0 && (
                        <div className="community-invite-control">
                          <select
                            className="input"
                            aria-label={`Choose a connection to invite to ${comm.name}`}
                            value={inviteSelections[comm.id] || ""}
                            onChange={(event) => setInviteSelections((current) => ({
                              ...current,
                              [comm.id]: event.target.value,
                            }))}
                          >
                            <option value="">Invite a connection…</option>
                            {connectionData.connections.map((connection) => {
                              const userId = connection.from_user === profile.user_id
                                ? connection.to_user
                                : connection.from_user;
                              const userName = connection.from_user === profile.user_id
                                ? connection.to_user_name
                                : connection.from_user_name;
                              return <option key={userId} value={userId}>{userName}</option>;
                            })}
                          </select>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleInviteToCommunity(comm.id)}>
                            Invite
                          </button>
                        </div>
                      )}
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
                    const request = connectionData.pending_sent.find((item) => item.to_user === person.id);
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
                            onClick={() => request
                              ? handleWithdrawConnection(request.id, person.id)
                              : handleConnect(person.id)}
                          >
                            {request ? "Withdraw request" : isConnected ? "Request sent" : "+ Connect"}
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
                    Connect with professionals to build your network and open direct messaging.
                  </p>
                  {displayedPeople.length > 0 && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleConnect(displayedPeople[0].id)}
                    >
                      Connect with a suggested professional
                    </button>
                  )}
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
                    <button className="btn btn-outline btn-sm" onClick={() => handleWithdrawConnection(c.id, c.to_user)}>
                      Withdraw request
                    </button>
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

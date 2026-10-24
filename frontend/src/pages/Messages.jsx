import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  getCommunities,
  getCommunityMessages,
  sendCommunityMessage,
  myConnections,
} from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Messages() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const directPartnerId = searchParams.get("to");
  const directCommunityId = searchParams.get("community");

  // Category Tab: 'personal' (Direct Messages) or 'groups' (Communities & Groups)
  const [channelType, setChannelType] = useState(directCommunityId ? "groups" : "personal");

  // Personal Direct Chats state
  const [conversations, setConversations] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(directPartnerId ? parseInt(directPartnerId) : null);
  const [activePartner, setActivePartner] = useState(null);
  const [personalMessages, setPersonalMessages] = useState([]);
  const [personalText, setPersonalText] = useState("");

  // Connections list for starting new chats
  const [connections, setConnections] = useState([]);
  const [showComposeModal, setShowComposeModal] = useState(false);

  // Communities & Groups state
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(() => {
    if (!directCommunityId) return null;
    let num = parseInt(directCommunityId);
    if (isNaN(num) && directCommunityId.startsWith("curated-")) {
      num = parseInt(directCommunityId.replace("curated-", ""));
    }
    return !isNaN(num) ? num : null;
  });
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [communityMessages, setCommunityMessages] = useState([]);
  const [communityText, setCommunityText] = useState("");

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const { showToast } = useToast();

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [personalMessages, communityMessages]);

  // Load threads and connections
  useEffect(() => {
    async function loadThreads() {
      setLoadingThreads(true);
      try {
        const [convData, commData, connData] = await Promise.all([
          getConversations().catch(() => []),
          getCommunities().catch(() => []),
          myConnections().catch(() => ({ connections: [] })),
        ]);

        setConversations(convData || []);
        setCommunities(commData || []);
        setConnections(connData?.connections || []);

        if (channelType === "personal") {
          if (directPartnerId) {
            const partnerIdInt = parseInt(directPartnerId);
            if (!isNaN(partnerIdInt)) {
              setSelectedPartnerId(partnerIdInt);
              const found = (convData || []).find((c) => c.partner_id === partnerIdInt);
              if (found) {
                setActivePartner(found);
              } else {
                // Check in connections
                const connFound = (connData?.connections || []).find(
                  (c) => c.from_user === partnerIdInt || c.to_user === partnerIdInt
                );
                if (connFound) {
                  const partnerName = connFound.from_user === profile?.user_id ? connFound.to_user_name : connFound.from_user_name;
                  const partnerHeadline = connFound.from_user === profile?.user_id ? connFound.to_user_headline : connFound.from_user_headline;
                  setActivePartner({ partner_id: partnerIdInt, partner_name: partnerName, partner_headline: partnerHeadline });
                } else {
                  setActivePartner({ partner_id: partnerIdInt, partner_name: `Member #${partnerIdInt}` });
                }
              }
            }
          } else if (!selectedPartnerId && convData && convData.length > 0) {
            setSelectedPartnerId(convData[0].partner_id);
            setActivePartner(convData[0]);
          } else if (selectedPartnerId && convData) {
            const found = convData.find((c) => c.partner_id === selectedPartnerId);
            if (found) setActivePartner(found);
          }
        } else {
          // Groups channel
          let targetComm = null;
          if (directCommunityId && commData && commData.length > 0) {
            let parsed = parseInt(directCommunityId);
            if (isNaN(parsed) && directCommunityId.startsWith("curated-")) {
              parsed = parseInt(directCommunityId.replace("curated-", ""));
            }
            if (!isNaN(parsed)) {
              targetComm = commData.find((c) => c.id === parsed) || commData[parsed - 1] || null;
            }
            if (!targetComm) {
              targetComm = commData.find(
                (c) =>
                  c.slug === directCommunityId ||
                  c.name.toLowerCase().includes(directCommunityId.toLowerCase())
              );
            }
          }

          if (!targetComm && selectedCommunityId && commData) {
            targetComm = commData.find((c) => c.id === selectedCommunityId);
          }

          if (!targetComm && commData && commData.length > 0) {
            targetComm = commData[0];
          }

          if (targetComm) {
            setSelectedCommunityId(targetComm.id);
            setActiveCommunity(targetComm);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingThreads(false);
      }
    }
    loadThreads();
  }, [channelType, directPartnerId, directCommunityId, profile?.user_id]);

  // Load direct messages
  const fetchPersonalMessages = useCallback(
    async (partnerId) => {
      if (!partnerId) return;
      setLoadingChat(true);
      try {
        const msgs = await getConversationMessages(partnerId);
        setPersonalMessages(msgs || []);
      } catch {
        showToast("Could not load conversation.", "error");
      } finally {
        setLoadingChat(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (channelType === "personal" && selectedPartnerId) {
      fetchPersonalMessages(selectedPartnerId);
    }
  }, [channelType, selectedPartnerId, fetchPersonalMessages]);

  // Load community messages
  const fetchCommunityMessages = useCallback(
    async (commId) => {
      const numId = Number(commId);
      if (!commId || isNaN(numId) || numId <= 0) return;
      setLoadingChat(true);
      try {
        const msgs = await getCommunityMessages(numId);
        setCommunityMessages(msgs || []);
      } catch {
        showToast("Could not load community group messages.", "error");
      } finally {
        setLoadingChat(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (channelType === "groups" && selectedCommunityId && !isNaN(Number(selectedCommunityId))) {
      fetchCommunityMessages(selectedCommunityId);
    }
  }, [channelType, selectedCommunityId, fetchCommunityMessages]);

  // Send Direct Message
  async function handleSendPersonal(e) {
    e.preventDefault();
    if (!personalText.trim() || !selectedPartnerId) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedPartnerId, { content: personalText.trim() });
      setPersonalMessages((prev) => [...prev, msg]);
      setPersonalText("");
      // Refresh conversation preview in sidebar
      getConversations().then((res) => setConversations(res || []));
    } catch {
      showToast("Unable to send message.", "error");
    } finally {
      setSending(false);
    }
  }

  // Send Community Message
  async function handleSendCommunity(e) {
    e.preventDefault();
    if (!communityText.trim() || !selectedCommunityId) return;
    setSending(true);
    try {
      const msg = await sendCommunityMessage(selectedCommunityId, communityText.trim());
      setCommunityMessages((prev) => [...prev, msg]);
      setCommunityText("");
    } catch {
      showToast("Unable to post to community.", "error");
    } finally {
      setSending(false);
    }
  }

  function handleStartChatWithContact(partnerId, partnerName, partnerHeadline) {
    setSelectedPartnerId(partnerId);
    setActivePartner({ partner_id: partnerId, partner_name: partnerName, partner_headline: partnerHeadline });
    setChannelType("personal");
    setShowComposeModal(false);
    setSearchParams({ to: partnerId });
  }

  return (
    <div className="container page" style={{ paddingTop: 16 }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Messaging</h2>
          <p className="text-xs muted" style={{ margin: "2px 0 0" }}>
            Direct conversations and community group discussions
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowComposeModal(true)}
          >
            ✍ + New Message
          </button>
          <Link to="/network" className="btn btn-outline btn-sm">
            Manage Network
          </Link>
        </div>
      </div>

      {/* Main Messaging Container */}
      <div className="messages-container">
        {/* Left Side: Tabs + Threads */}
        <div className="messages-sidebar">
          {/* Top Tabs */}
          <div className="messages-tabs-header">
            <button
              className={`messages-tab-btn ${channelType === "personal" ? "active" : ""}`}
              onClick={() => {
                setChannelType("personal");
                setSearchParams({});
              }}
            >
              Direct Messages
            </button>
            <button
              className={`messages-tab-btn ${channelType === "groups" ? "active" : ""}`}
              onClick={() => {
                setChannelType("groups");
                setSearchParams({});
              }}
            >
              Communities & Groups
            </button>
          </div>

          {/* Thread List */}
          <div className="messages-thread-list">
            {loadingThreads ? (
              <div style={{ textAlign: "center", padding: 36 }}>
                <div className="spinner" />
              </div>
            ) : channelType === "personal" ? (
              conversations.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <p className="muted text-sm" style={{ fontWeight: 600 }}>No conversations yet</p>
                  <p className="text-xs muted" style={{ margin: "4px 0 12px" }}>
                    Select a connected member to start discussing opportunities.
                  </p>
                  {connections.length > 0 ? (
                    <div style={{ textAlign: "left", marginTop: 10 }}>
                      <span className="text-xs font-semibold muted" style={{ textTransform: "uppercase" }}>
                        Your Connections:
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                        {connections.slice(0, 5).map((c) => {
                          const partnerId = c.from_user === profile?.user_id ? c.to_user : c.from_user;
                          const partnerName = c.from_user === profile?.user_id ? c.to_user_name : c.from_user_name;
                          const partnerHeadline = c.from_user === profile?.user_id ? c.to_user_headline : c.from_user_headline;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ justifyContent: "flex-start", padding: "6px 8px", textAlign: "left" }}
                              onClick={() => handleStartChatWithContact(partnerId, partnerName, partnerHeadline)}
                            >
                              💬 {partnerName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <Link to="/network" className="btn btn-outline btn-sm">
                      Find Connections
                    </Link>
                  )}
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.partner_id}
                    className={`message-thread-item ${
                      selectedPartnerId === conv.partner_id ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedPartnerId(conv.partner_id);
                      setActivePartner(conv);
                      setSearchParams({ to: conv.partner_id });
                    }}
                  >
                    {conv.partner_avatar ? (
                      <img
                        src={conv.partner_avatar}
                        alt={conv.partner_name}
                        className="message-thread-avatar"
                      />
                    ) : (
                      <div className="message-thread-avatar">
                        {(conv.partner_name || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="message-thread-info">
                      <div className="message-thread-name">
                        <span>{conv.partner_name}</span>
                        {conv.unread_count > 0 && (
                          <span
                            className="badge"
                            style={{ background: "var(--brand-strong)", color: "#fff", fontSize: 10 }}
                          >
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="message-thread-snippet">
                        {conv.last_message || "Active conversation"}
                      </p>
                    </div>
                  </div>
                ))
              )
            ) : communities.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <p className="muted text-sm">No communities joined yet.</p>
                <Link to="/network" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
                  Explore Communities
                </Link>
              </div>
            ) : (
              communities.map((comm) => (
                <div
                  key={comm.id}
                  className={`message-thread-item ${
                    selectedCommunityId === comm.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setSelectedCommunityId(comm.id);
                    setActiveCommunity(comm);
                    setSearchParams({ community: comm.id });
                  }}
                >
                  <div
                    className="message-thread-avatar"
                    style={{ background: "#E0F2FE", color: "var(--brand-strong)", borderRadius: 8 }}
                  >
                    {comm.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="message-thread-info">
                    <div className="message-thread-name">
                      <span>{comm.name}</span>
                      <span
                        className={`community-pill ${
                          comm.community_type === "opensource"
                            ? "opensource"
                            : comm.community_type === "private"
                            ? "private"
                            : "public"
                        }`}
                        style={{ fontSize: 9 }}
                      >
                        {comm.community_type === "opensource" ? "OS" : comm.community_type}
                      </span>
                    </div>
                    <p className="message-thread-snippet">
                      {comm.description || `${comm.members_count || 1} members active`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Chat Stream */}
        <div className="messages-main-pane">
          {channelType === "personal" ? (
            selectedPartnerId ? (
              <>
                <div className="messages-chat-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      className="message-thread-avatar"
                      style={{ width: 38, height: 38, fontSize: 14 }}
                    >
                      {(activePartner?.partner_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, display: "block", color: "var(--ink)" }}>
                        {activePartner?.partner_name || "Direct Message"}
                      </strong>
                      <span className="text-xs muted">
                        {activePartner?.partner_headline || "GenHire Professional Member"}
                      </span>
                    </div>
                  </div>
                  <Link to={`/profile/${selectedPartnerId}`} className="btn btn-ghost btn-sm">
                    View Profile
                  </Link>
                </div>

                {/* Message Bubbles */}
                <div className="messages-bubble-stream">
                  {loadingChat ? (
                    <div style={{ margin: "auto" }}>
                      <div className="spinner" />
                    </div>
                  ) : personalMessages.length === 0 ? (
                    <div style={{ margin: "auto", textAlign: "center", padding: "40px 20px" }} className="muted text-sm">
                      <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                      <h4 style={{ margin: "0 0 6px", color: "var(--ink)" }}>
                        Start a conversation with {activePartner?.partner_name || "this member"}
                      </h4>
                      <p className="text-xs" style={{ maxWidth: 360, margin: "0 auto" }}>
                        Discuss role openings, exchange technical background, or schedule an interview.
                      </p>
                    </div>
                  ) : (
                    personalMessages.map((msg) => {
                      const isMe = msg.sender === profile?.user_id || msg.sender_username === profile?.username;
                      return (
                        <div key={msg.id} className={`chat-bubble ${isMe ? "mine" : "theirs"}`}>
                          <div>{msg.content}</div>
                          <div className="chat-bubble-time">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendPersonal} className="messages-composer-bar">
                  <input
                    type="text"
                    className="input"
                    placeholder={`Message ${activePartner?.partner_name || ""}...`}
                    value={personalText}
                    onChange={(e) => setPersonalText(e.target.value)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={sending || !personalText.trim()}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ margin: "auto", textAlign: "center", padding: 40 }} className="muted">
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <h3 style={{ margin: "0 0 6px", color: "var(--ink)" }}>Your Messages</h3>
                <p className="text-sm muted" style={{ maxWidth: 360, margin: "0 auto 18px" }}>
                  Select an active conversation on the left or compose a new message to connected colleagues.
                </p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowComposeModal(true)}>
                  ✍ Start New Conversation
                </button>
              </div>
            )
          ) : selectedCommunityId ? (
            <>
              <div className="messages-chat-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    className="community-icon"
                    style={{ width: 38, height: 38, fontSize: 15 }}
                  >
                    {(activeCommunity?.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong style={{ fontSize: 15, display: "block", color: "var(--ink)" }}>
                      {activeCommunity?.name || "Community Channel"}
                    </strong>
                    <span className="text-xs muted">
                      {activeCommunity?.community_type === "opensource"
                        ? "Open-Source Community Channel"
                        : "Group Discussion"}{" "}
                      • {activeCommunity?.members_count || 1} members
                    </span>
                  </div>
                </div>
                <span
                  className={`community-pill ${
                    activeCommunity?.community_type === "opensource"
                      ? "opensource"
                      : "public"
                  }`}
                >
                  {activeCommunity?.community_type?.toUpperCase()}
                </span>
              </div>

              {/* Group Message Stream */}
              <div className="messages-bubble-stream">
                {loadingChat ? (
                  <div style={{ margin: "auto" }}>
                    <div className="spinner" />
                  </div>
                ) : communityMessages.length === 0 ? (
                  <div style={{ margin: "auto", textAlign: "center", padding: 36 }} className="muted text-sm">
                    <p style={{ fontWeight: 600 }}>Welcome to #{activeCommunity?.name || "this community"}!</p>
                    <p className="text-xs">
                      Share updates, collaborate, and communicate with members of this channel.
                    </p>
                  </div>
                ) : (
                  communityMessages.map((msg) => {
                    const isMe = msg.sender === profile?.user_id || msg.sender_name === profile?.username;
                    return (
                      <div key={msg.id} className={`chat-bubble ${isMe ? "mine" : "theirs"}`}>
                        {!isMe && (
                          <div className="chat-bubble-sender">
                            {msg.sender_name}
                            {msg.sender_headline ? ` • ${msg.sender_headline}` : ""}
                          </div>
                        )}
                        <div>{msg.content}</div>
                        <div className="chat-bubble-time">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Group Composer */}
              <form onSubmit={handleSendCommunity} className="messages-composer-bar">
                <input
                  type="text"
                  className="input"
                  placeholder={`Post message to #${activeCommunity?.name || "community"}...`}
                  value={communityText}
                  onChange={(e) => setCommunityText(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={sending || !communityText.trim()}
                >
                  {sending ? "Posting..." : "Post Message"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: "auto", textAlign: "center", padding: 40 }} className="muted">
              <h4>No channel selected</h4>
              <p className="text-sm">Choose a community from the left to read and send group messages.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showComposeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowComposeModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 440, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>New Message</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowComposeModal(false)}>✕</button>
            </div>

            {connections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p className="muted text-sm">You haven't established connections yet.</p>
                <p className="text-xs muted" style={{ margin: "4px 0 14px" }}>
                  Connect with professionals from the Network tab to exchange direct messages.
                </p>
                <Link
                  to="/network"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowComposeModal(false)}
                >
                  Discover Connections
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="text-xs muted font-semibold" style={{ textTransform: "uppercase" }}>
                  Select Connection:
                </span>
                {connections.map((c) => {
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
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "#F8FAFC",
                      }}
                      onClick={() => handleStartChatWithContact(partnerId, partnerName, partnerHeadline)}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>{partnerName}</strong>
                        <p className="text-xs muted" style={{ margin: "2px 0 0" }}>
                          {partnerHeadline || "GenHire Member"}
                        </p>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: "4px 10px" }}>
                        Chat →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

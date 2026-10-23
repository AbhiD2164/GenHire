import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  getCommunities,
  getCommunityMessages,
  sendCommunityMessage,
} from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Messages() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const directPartnerId = searchParams.get("to");
  const directCommunityId = searchParams.get("community");

  // Main Category Tab: 'personal' (1-on-1) or 'groups' (Communities & Open-Source)
  const [channelType, setChannelType] = useState(directCommunityId ? "groups" : "personal");

  // Personal Direct Chats state
  const [conversations, setConversations] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(directPartnerId ? parseInt(directPartnerId) : null);
  const [activePartner, setActivePartner] = useState(null);
  const [personalMessages, setPersonalMessages] = useState([]);
  const [personalText, setPersonalText] = useState("");

  // Communities & Groups state
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(
    directCommunityId ? parseInt(directCommunityId) : null
  );
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

  // Load threads when channelType changes
  useEffect(() => {
    async function loadThreads() {
      setLoadingThreads(true);
      try {
        if (channelType === "personal") {
          const data = await getConversations();
          setConversations(data || []);
          if (!selectedPartnerId && data && data.length > 0) {
            setSelectedPartnerId(data[0].partner_id);
            setActivePartner(data[0]);
          } else if (selectedPartnerId && data) {
            const found = data.find((c) => c.partner_id === selectedPartnerId);
            if (found) setActivePartner(found);
          }
        } else {
          const commData = await getCommunities();
          setCommunities(commData || []);
          if (!selectedCommunityId && commData && commData.length > 0) {
            setSelectedCommunityId(commData[0].id);
            setActiveCommunity(commData[0]);
          } else if (selectedCommunityId && commData) {
            const found = commData.find((c) => c.id === selectedCommunityId);
            if (found) setActiveCommunity(found);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingThreads(false);
      }
    }
    loadThreads();
  }, [channelType, selectedPartnerId, selectedCommunityId]);

  // Load 1-on-1 messages when partner changes
  const fetchPersonalMessages = useCallback(
    async (partnerId) => {
      if (!partnerId) return;
      setLoadingChat(true);
      try {
        const msgs = await getConversationMessages(partnerId);
        setPersonalMessages(msgs || []);
      } catch {
        showToast("Could not load personal conversation.", "error");
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

  // Load community messages when community changes
  const fetchCommunityMessages = useCallback(
    async (commId) => {
      if (!commId) return;
      setLoadingChat(true);
      try {
        const msgs = await getCommunityMessages(commId);
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
    if (channelType === "groups" && selectedCommunityId) {
      fetchCommunityMessages(selectedCommunityId);
    }
  }, [channelType, selectedCommunityId, fetchCommunityMessages]);

  // Send Personal 1-on-1 Message
  async function handleSendPersonal(e) {
    e.preventDefault();
    if (!personalText.trim() || !selectedPartnerId) return;
    setSending(true);
    try {
      const sent = await sendMessage(selectedPartnerId, { content: personalText.trim() });
      setPersonalMessages((prev) => [...prev, sent]);
      setPersonalText("");
      // Update snippet in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.partner_id === selectedPartnerId ? { ...c, last_message: sent.content } : c
        )
      );
    } catch (err) {
      showToast(err?.response?.data?.detail || "Message delivery failed.", "error");
    } finally {
      setSending(false);
    }
  }

  // Send Community / Group Message
  async function handleSendCommunity(e) {
    e.preventDefault();
    if (!communityText.trim() || !selectedCommunityId) return;
    setSending(true);
    try {
      const sent = await sendCommunityMessage(selectedCommunityId, communityText.trim());
      setCommunityMessages((prev) => [...prev, sent]);
      setCommunityText("");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Group message delivery failed.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container page" style={{ paddingTop: 16 }}>
      {/* Header bar */}
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow" style={{ margin: 0 }}>Communication Hub</span>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800 }}>Messaging & Communities</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
              Direct Chats (1-on-1)
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
                <div style={{ padding: 24, textAlign: "center" }}>
                  <p className="muted text-sm">No 1-on-1 chats yet.</p>
                  <p className="text-xs muted">
                    Connect with candidates or recruiters from your network to start chatting!
                  </p>
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
                        {conv.last_message || "Active connection"}
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
                        {activePartner?.partner_headline || "1-on-1 Private Conversation"}
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
                    <div style={{ margin: "auto", textAlign: "center" }} className="muted text-sm">
                      <p>Start a secure private conversation with this member.</p>
                      <p className="text-xs">
                        Exchange inquiries, schedule interviews, and share portfolio details.
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
                    placeholder="Write a private message..."
                    value={personalText}
                    onChange={(e) => setPersonalText(e.target.value)}
                    style={{ flex: 1 }}
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
                <h4>No personal conversation selected</h4>
                <p className="text-sm">Choose a contact on the left to read and send messages.</p>
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
                      {activeCommunity?.name || "Community Group"}
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
                  <div style={{ margin: "auto", textAlign: "center" }} className="muted text-sm">
                    <p>Welcome to #{activeCommunity?.name || "this community"}!</p>
                    <p className="text-xs">
                      Share updates, ask questions, and collaborate with all members of this group.
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
                  placeholder={`Post to #${activeCommunity?.name || "community"}...`}
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
              <h4>No group or community selected</h4>
              <p className="text-sm">Select an open-source group or community from the left list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

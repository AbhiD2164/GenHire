import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getConversations, getConversationMessages, sendMessage } from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Messages() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const directPartnerId = searchParams.get("to");

  const [conversations, setConversations] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(directPartnerId ? parseInt(directPartnerId) : null);
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState("private");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const { showToast } = useToast();

  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data || []);
      if (!selectedPartnerId && data && data.length > 0) {
        setSelectedPartnerId(data[0].partner_id);
        setActivePartner(data[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, [selectedPartnerId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (partnerId) => {
    if (!partnerId) return;
    setLoadingMessages(true);
    try {
      const data = await getConversationMessages(partnerId);
      setMessages(data || []);
    } catch {
      showToast("Could not load messages.", "error");
    } finally {
      setLoadingMessages(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedPartnerId) {
      fetchMessages(selectedPartnerId);
      const found = conversations.find((c) => c.partner_id === selectedPartnerId);
      if (found) setActivePartner(found);
    }
  }, [selectedPartnerId, fetchMessages, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !selectedPartnerId) return;
    setSending(true);
    try {
      const newMsg = await sendMessage(selectedPartnerId, {
        content: messageText.trim(),
        message_type: messageType,
      });
      setMessages((prev) => [...prev, newMsg]);
      setMessageText("");
      fetchConversations();
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not send message.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page container messages-page">
      <div style={{ marginBottom: 16 }}>
        <span className="eyebrow" style={{ margin: 0 }}>Networking Communications</span>
        <h1 style={{ fontSize: "1.75rem", margin: "4px 0 0" }}>Messages</h1>
        <p className="muted text-sm">Direct private conversations and professional inquiries with your connections.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, minHeight: 520, background: "var(--card-bg, #1a1e27)", border: "1px solid var(--border-color, #2a2f3d)", borderRadius: 12, overflow: "hidden" }}>
        {/* Left: Conversation list */}
        <div style={{ borderRight: "1px solid var(--border-color, #2a2f3d)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color, #2a2f3d)", fontWeight: 600, fontSize: "0.95rem" }}>
            Conversations ({conversations.length})
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><div className="spinner" /></div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted, #8b949e)", fontSize: "0.88rem" }}>
                No message threads yet. Visit candidate or connection profiles to start conversations.
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.partner_id}
                  onClick={() => {
                    setSelectedPartnerId(conv.partner_id);
                    setActivePartner(conv);
                  }}
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: selectedPartnerId === conv.partner_id ? "rgba(99, 102, 241, 0.12)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--brand-primary, #6366f1)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    {(conv.partner_name || "?")[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {conv.partner_name}
                      </strong>
                      {conv.unread_count > 0 && (
                        <span style={{ background: "#6366f1", color: "#fff", borderRadius: 10, padding: "2px 6px", fontSize: "0.72rem", fontWeight: 700 }}>
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text-muted, #8b949e)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {conv.last_message || "Started a conversation"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Active chat window */}
        <div style={{ display: "flex", flexDirection: "column", height: 580 }}>
          {selectedPartnerId ? (
            <>
              {/* Chat header */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color, #2a2f3d)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
                    {(activePartner?.partner_name || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>{activePartner?.partner_name || "Conversation"}</h3>
                    <span className="text-xs muted">{activePartner?.partner_headline || "Active member"}</span>
                  </div>
                </div>

                <Link to={`/profile/${selectedPartnerId}`} className="btn btn-outline btn-sm">
                  View Profile
                </Link>
              </div>

              {/* Message scroll area */}
              <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {loadingMessages ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>
                ) : messages.length === 0 ? (
                  <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted, #8b949e)", fontSize: "0.9rem" }}>
                    Say hello! Send your first direct message below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender === profile.user_id || m.sender_username === profile.username;
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "70%",
                          background: isMe ? "var(--brand-primary, #6366f1)" : "var(--bg-subtle, #252a36)",
                          color: isMe ? "#fff" : "inherit",
                          padding: "10px 14px",
                          borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          fontSize: "0.9rem",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        }}
                      >
                        <div>{m.content}</div>
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 4 }}>
                          {m.message_type === "public" && (
                            <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>Public Note</span>
                          )}
                          <span style={{ fontSize: "0.7rem", opacity: 0.75 }}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message composer input */}
              <form onSubmit={handleSendMessage} style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color, #2a2f3d)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write a message..."
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 8 }}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" disabled={sending || !messageText.trim()}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.78rem" }}>
                  <span className="muted">Type:</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="msgType"
                      checked={messageType === "private"}
                      onChange={() => setMessageType("private")}
                    />
                    Private Message
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="msgType"
                      checked={messageType === "public"}
                      onChange={() => setMessageType("public")}
                    />
                    Public Note
                  </label>
                </div>
              </form>
            </>
          ) : (
            <div style={{ margin: "auto", textAlign: "center", padding: 40, color: "var(--text-muted, #8b949e)" }}>
              <h3>Select a conversation</h3>
              <p>Choose an ongoing thread from the left or connect with users in your network.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

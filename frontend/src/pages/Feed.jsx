import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getFeed, createPost, toggleLike, addComment, getConversations,
  updateCommunityMembership,
} from "../api/network";
import { listJobs } from "../api/jobs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const NEWS_STORIES = [
  { id: 1, title: "Global hiring trends indicate surge in specialized cross-industry skills", readers: "14,280 readers" },
  { id: 2, title: "Autonomous ATS screening adoption grows across engineering & healthcare", readers: "8,940 readers" },
  { id: 3, title: "How professional credentials build trust across a network", readers: "5,320 readers" },
  { id: 4, title: "Open-source developer communities shape next-gen architecture", readers: "3,110 readers" },
];

export default function Feed() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [dockOpen, setDockOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState([]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [feedData, jobsData, convsData] = await Promise.all([
        getFeed(),
        listJobs().catch(() => ({ results: [] })),
        getConversations().catch(() => []),
      ]);
      setPosts(feedData.results || feedData || []);
      setRecommendedJobs((jobsData.results || jobsData || []).slice(0, 3));
      setRecentConversations(convsData || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  function handleNewPost(post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <div className="page container" style={{ paddingTop: 20 }}>
      <div className="linkedin-grid-3">
        {/* Left Column: User Profile Summary & Communities */}
        <aside className="sticky-sidebar-left">
          {profile && (
            <div className="user-mini-card">
              <div className="user-mini-banner" />
              <div className="user-mini-avatar-wrap">
                <Link to="/profile">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" className="user-mini-avatar" />
                  ) : (
                    <div className="user-mini-avatar-fallback">
                      {(profile.full_name || profile.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </div>
              <div className="user-mini-body">
                <Link to="/profile">
                  <h3>{profile.full_name || profile.username}</h3>
                </Link>
                <p>{profile.headline || "Professional Member"}</p>
                {profile.location && <span className="text-xs muted" style={{ display: "block", marginTop: 4 }}>📍 {profile.location}</span>}
              </div>

              <div className="user-mini-stats">
                <div className="stat-row">
                  <span>Profile status</span>
                  <strong>{profile.company_name ? `Corporate (${profile.company_name})` : "Active Member"}</strong>
                </div>
                <div className="stat-row">
                  <span>Total experience</span>
                  <strong>{Math.floor((profile.total_experience_months || 0) / 12)} yrs</strong>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px" }}>
                <Link to="/dashboard" className="text-sm" style={{ color: "var(--brand-strong)", fontWeight: 600, display: "block" }}>
                  📑 Track Applied Jobs
                </Link>
              </div>
            </div>
          )}

          {/* Groups & Navigation card */}
          <div className="sidebar-nav-card">
            <h4>Quick Navigation</h4>
            <Link to="/network" className="sidebar-link-item">
              <span>👥</span> Network & Connections
            </Link>
            <Link to="/messages" className="sidebar-link-item">
              <span>💬</span> Messages & Communities
            </Link>
            <Link to="/jobs" className="sidebar-link-item">
              <span>💼</span> Job Opportunities
            </Link>
            <Link to="/resume-analysis" className="sidebar-link-item">
              <span>📄</span> ATS Resume Analyzer
            </Link>
          </div>
        </aside>

        {/* Center Column: Feed Composer, Filters, and Posts */}
        <main className="feed-center">
          <StartPostBox onPosted={handleNewPost} />

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div className="spinner" />
            </div>
          ) : posts.length === 0 ? (
            <div className="card empty-state" style={{ padding: 40, textAlign: "center" }}>
              <h3>Your feed is ready for a first update</h3>
              <p className="muted">Share an update, job opportunity, or project with your network.</p>
            </div>
          ) : (
            posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                onTagClick={(tag) => navigate(`/search?q=${encodeURIComponent(tag)}`)}
              />
            ))
          )}
        </main>

        {/* Right Column: Trending News & Recommended Jobs */}
        <aside className="sticky-sidebar-right">
          <div className="news-card">
            <h4>
              <span>GenHire Insights</span>
              <span className="tag text-xs" style={{ background: "rgba(14, 165, 233, 0.12)", color: "#0284c7" }}>Live</span>
            </h4>
            {NEWS_STORIES.map((story) => (
              <div key={story.id} className="news-item">
                <h5>• {story.title}</h5>
                <span>{story.readers}</span>
              </div>
            ))}
          </div>

          {recommendedJobs.length > 0 && (
            <div className="news-card">
              <h4>
                <span>Recommended Jobs</span>
                <Link to="/jobs" className="text-xs" style={{ color: "var(--brand-strong)" }}>View all</Link>
              </h4>
              {recommendedJobs.map((job) => (
                <div key={job.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                  <Link to={`/jobs/${job.id}`}>
                    <strong style={{ fontSize: "13.5px", color: "var(--ink)", display: "block" }}>{job.title}</strong>
                  </Link>
                  <p className="text-xs muted" style={{ margin: "2px 0 6px" }}>{job.company_name} · {job.location}</p>
                  <Link to={`/jobs/${job.id}`} className="btn btn-outline btn-sm" style={{ padding: "4px 10px", fontSize: "12px" }}>
                    View & Apply
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: "0 8px", fontSize: "11px", color: "var(--slate)", lineHeight: 1.6, textAlign: "center" }}>
            GenHire Corporation © 2026. All rights reserved. Professional Network & ATS Screener.
          </div>
        </aside>
      </div>

      {/* Floating Bottom-Right Messaging Dock */}
      <div className="floating-messaging-dock">
        <div className="dock-header" onClick={() => setDockOpen(!dockOpen)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "16px" }}>💬</span>
            <span>Messaging</span>
          </div>
          <span>{dockOpen ? "▼" : "▲"}</span>
        </div>

        {dockOpen && (
          <div className="dock-body">
            {recentConversations.length === 0 ? (
              <p className="text-xs muted" style={{ textAlign: "center", marginTop: 40 }}>
                No active message threads yet. Connect with members to start chats.
              </p>
            ) : (
              recentConversations.map((conv) => (
                <Link
                  key={conv.partner_id}
                  to={`/messages?to=${conv.partner_id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--brand)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {(conv.partner_name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{conv.partner_name}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.last_message}
                    </div>
                  </div>
                </Link>
              ))
            )}
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <Link to="/messages" className="btn btn-outline btn-sm btn-block">
                Open Full Messenger
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StartPostBox({ onPosted }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const post = await createPost({ content: content.trim() });
      onPosted(post);
      setContent("");
      setOpen(false);
      showToast("Post published!", "success");
    } catch {
      showToast("Could not publish post.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="start-post-card">
      <div className="start-post-top">
        <div className="post-avatar-fallback" style={{ width: 44, height: 44, fontSize: "16px" }}>
          {(profile?.full_name || profile?.username || "?")[0].toUpperCase()}
        </div>
        <button type="button" className="start-post-input" onClick={() => setOpen(true)}>
          Share an update with your professional network...
        </button>
      </div>

      <div className="start-post-actions">
        <button type="button" className="post-action-btn" onClick={() => setOpen(true)}>
          <span style={{ color: "#f59e0b" }}>✍</span> Write a post
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to talk about? Use hashtags like #hiring, #careers, #projects..."
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
            autoFocus
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !content.trim()}>
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function FeedPostCard({ post, onTagClick }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState("");
  const [joinedCommunity, setJoinedCommunity] = useState(post.community_joined_by_me);
  const [joinRequestStatus, setJoinRequestStatus] = useState(post.community_join_request_status);
  const [joiningComm, setJoiningComm] = useState(false);
  const { showToast } = useToast();

  async function handleLike() {
    try {
      const res = await toggleLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.like_count);
    } catch {
      showToast("Could not like post.", "error");
    }
  }

  async function handleJoinCommunity() {
    setJoiningComm(true);
    try {
      const res = await updateCommunityMembership(post.community, "join");
      setJoinedCommunity(res.joined);
      setJoinRequestStatus(res.join_request_status);
      showToast(
        res.joined
          ? `Joined ${post.community_name}!`
          : res.join_request_status === "pending"
            ? "Join request sent for admin approval."
            : `Left ${post.community_name}.`,
        "success",
      );
    } catch {
      showToast("Could not update community membership.", "error");
    } finally {
      setJoiningComm(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const comment = await addComment(post.id, commentText.trim());
      setComments((prev) => [...prev, comment]);
      setCommentText("");
    } catch {
      showToast("Could not add comment.", "error");
    }
  }

  // Render text highlighting #hashtags as clickable elements
  function renderContent(text) {
    const parts = (text || "").split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        return (
          <span key={i} className="post-hashtag" onClick={() => onTagClick(part)}>
            {part}{" "}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <article className="post-card">
      {/* Community Join Banner — shown at top of post if it belongs to a community the user hasn't joined */}
      {post.community && joinedCommunity === false && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "#F0F9FF",
            borderBottom: "1px solid #BAE6FD",
            borderRadius: "10px 10px 0 0",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>👥</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0369A1" }}>
                {post.community_name}
              </span>
              <p style={{ margin: 0, fontSize: 11.5, color: "#64748B" }}>
                Post from a community you haven't joined yet
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, padding: "5px 14px", whiteSpace: "nowrap" }}
            onClick={handleJoinCommunity}
            disabled={joiningComm || joinRequestStatus === "pending"}
          >
            {joiningComm
              ? "Sending..."
              : joinRequestStatus === "pending"
                ? "Request pending"
                : post.community_type === "private"
                  ? "Request to join"
                  : "Join Community"}
          </button>
        </div>
      )}

      {/* Already joined: show subtle community tag at top */}
      {post.community && joinedCommunity === true && (
        <div
          style={{
            padding: "5px 14px",
            background: "#F8FAFC",
            borderBottom: "1px solid var(--border)",
            borderRadius: "10px 10px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
            👥 {post.community_name}
          </span>
          <span style={{ fontSize: 10.5, color: "#64748B" }}>· You're a member</span>
          <Link
            to={`/messages?community=${post.community}`}
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--brand-strong)" }}
          >
            Community chat →
          </Link>
        </div>
      )}

      <div className="post-header">
        <div className="post-author-info">
          <Link to={`/profile/${post.author}`}>
            {post.author_avatar ? (
              <img src={post.author_avatar} alt="" className="post-avatar" />
            ) : (
              <div className="post-avatar-fallback">{(post.author_name || "?")[0].toUpperCase()}</div>
            )}
          </Link>
          <div>
            <Link to={`/profile/${post.author}`}>
              <strong style={{ fontSize: "14.5px", color: "var(--ink)" }}>{post.author_name}</strong>
            </Link>
            <p className="muted text-xs" style={{ margin: "1px 0" }}>
              {post.author_headline || "GenHire Professional"}
            </p>
            <span className="text-xs muted">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <Link to={`/messages?to=${post.author}`} className="btn btn-outline btn-sm" style={{ padding: "4px 10px", fontSize: "12px" }}>
          Message
        </Link>
      </div>

      <div className="post-content">{renderContent(post.content)}</div>

      {post.image && <img src={post.image} alt="" style={{ width: "100%", borderRadius: "8px", marginBottom: "12px" }} />}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--slate)", padding: "4px 0" }}>
        <span>👍 {likeCount} likes</span>
        <span style={{ cursor: "pointer" }} onClick={() => setShowComments(!showComments)}>
          💬 {comments.length} comments
        </span>
      </div>

      <div className="post-actions-bar">
        <button type="button" className={`post-act-btn ${liked ? "liked" : ""}`} onClick={handleLike}>
          <span>{liked ? "👍 Liked" : "👍 Like"}</span>
        </button>
        <button type="button" className="post-act-btn" onClick={() => setShowComments(!showComments)}>
          <span>💬 Comment</span>
        </button>
        <Link to={`/messages?to=${post.author}`} className="post-act-btn">
          <span>↗ Send DM</span>
        </Link>
      </div>

      {showComments && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              style={{ flex: 1, padding: "8px 12px", borderRadius: "20px", border: "1px solid var(--border)" }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!commentText.trim()}>
              Comment
            </button>
          </form>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", fontSize: "13px" }}>
                <strong>{c.author_name}: </strong>
                <span>{c.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

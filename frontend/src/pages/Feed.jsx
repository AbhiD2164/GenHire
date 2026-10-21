import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getFeed, createPost, toggleLike, addComment } from "../api/network";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const POST_TYPES = [
  ["update", "General update"],
  ["job_posting", "Job posting"],
  ["project", "Project build"],
  ["article", "Article"],
];

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFeed(filter ? { post_type: filter } : {});
      setPosts(data.results || data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  function handleNewPost(post) {
    setPosts((p) => [post, ...p]);
  }

  return (
    <div className="page container feed-page">
      <div className="feed-main">
        <ComposeBox onPosted={handleNewPost} />

        <div className="feed-filter-row">
          <button className={`chip-filter ${filter === "" ? "active" : ""}`} onClick={() => setFilter("")}>All</button>
          {POST_TYPES.map(([val, label]) => (
            <button key={val} className={`chip-filter ${filter === val ? "active" : ""}`} onClick={() => setFilter(val)}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <h3>No posts yet</h3>
            <p>Be the first to share an update, project, or job opening.</p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      <div className="feed-side">
        <div className="card">
          <h4>Why post here?</h4>
          <p className="text-sm muted">
            Share project builds, job openings, or career updates. Your network sees it instantly in their feed.
          </p>
        </div>
      </div>
    </div>
  );
}

function ComposeBox({ onPosted }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("update");
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const post = await createPost({ content, post_type: postType });
      onPosted(post);
      setContent("");
      setPostType("update");
      setOpen(false);
      showToast("Posted!", "success");
    } catch {
      showToast("Could not publish post.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card compose-box">
      <div className="compose-trigger" onClick={() => setOpen(true)}>
        <div className="nav-avatar-fallback compose-avatar">{(profile?.full_name || "?")[0].toUpperCase()}</div>
        {!open && <span className="muted">Share an update, project, or job opening…</span>}
      </div>

      {open && (
        <form onSubmit={handleSubmit}>
          <textarea
            autoFocus
            rows={4}
            placeholder="What do you want to share?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="compose-footer">
            <select value={postType} onChange={(e) => setPostType(e.target.value)}>
              {POST_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-amber btn-sm" disabled={submitting}>{submitting ? "Posting…" : "Post"}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function PostCard({ post }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState("");

  async function handleLike() {
    const result = await toggleLike(post.id);
    setLiked(result.liked);
    setLikeCount(result.like_count);
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const comment = await addComment(post.id, commentText);
    setComments((c) => [...c, comment]);
    setCommentText("");
  }

  const typeLabel = POST_TYPES.find(([v]) => v === post.post_type)?.[1] || "Update";

  return (
    <div className="card post-card">
      <div className="post-header">
        <Link to={`/profile/${post.author}`} className="nav-avatar-fallback post-avatar">
          {post.author_name[0].toUpperCase()}
        </Link>
        <div>
          <strong>{post.author_name}</strong>
          <p className="text-sm muted">{post.author_headline || (post.author_role === "recruiter" ? "Recruiter" : "Job seeker")}</p>
        </div>
        <span className="tag" style={{ marginLeft: "auto" }}>{typeLabel}</span>
      </div>

      <p className="post-content">{post.content}</p>
      {post.image && <img src={post.image} alt="" className="post-image" />}

      <div className="post-actions">
        <button className={`post-action ${liked ? "liked" : ""}`} onClick={handleLike}>
          {liked ? "♥" : "♡"} {likeCount}
        </button>
        <button className="post-action" onClick={() => setShowComments((s) => !s)}>
          💬 {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="comment-section">
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <strong>{c.author_name}</strong>
              <span>{c.content}</span>
            </div>
          ))}
          <form onSubmit={handleComment} className="comment-form">
            <input placeholder="Write a comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
            <button className="btn btn-ghost btn-sm">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

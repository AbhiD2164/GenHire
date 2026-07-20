import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ username, password });
      navigate("/feed");
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid email/username or password.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">Welcome back</span>
        <h1>Log in to GenHire</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 28 }}>
          Find roles, screen candidates, and keep building your network.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email or username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
          <GoogleSignInButton
            onSuccess={async () => {
              await refreshProfile();
              navigate("/feed");
            }}
          />
        </div>

        <p className="text-sm muted" style={{ marginTop: 20, textAlign: "center" }}>
          Forgot password? <Link to="/forgot-password" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>Reset it</Link>
        </p>

        <p className="text-sm muted" style={{ marginTop: 10, textAlign: "center" }}>
          New to GenHire? <Link to="/signup" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

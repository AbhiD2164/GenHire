import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { loginWithFirebaseGoogle } from "../utils/firebase";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithFirebase } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      showToast("Welcome back!", "success");
      navigate("/feed");
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid credentials. Please verify your email/username and password.";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { idToken } = await loginWithFirebaseGoogle();
      await loginWithFirebase({ id_token: idToken });
      showToast("Signed in successfully with Google!", "success");
      navigate("/feed");
    } catch (err) {
      showToast(err.message || "Google sign-in could not be completed.", "error");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card" style={{ maxWidth: 440, width: "100%", margin: "40px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span className="eyebrow" style={{ margin: "0 auto 6px" }}>Unified Access</span>
          <h1 style={{ fontSize: 24, margin: "0 0 6px", fontWeight: 800 }}>Sign In to GenHire</h1>
          <p className="muted text-sm" style={{ margin: 0 }}>
            Stay connected to your professional network and career opportunities.
          </p>
        </div>

        {/* Single Unified Google Auth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "10px 16px",
            background: "#FFFFFF",
            color: "#1F2937",
            border: "1px solid #D1D5DB",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span className="text-xs muted font-semibold">OR SIGN IN WITH EMAIL</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email or Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. you@company.com or username"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>Password</label>
              <Link to="/forgot-password" className="text-xs" style={{ color: "var(--brand-strong)" }}>
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting} style={{ marginTop: 12 }}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-sm muted" style={{ marginTop: 24, textAlign: "center" }}>
          New to GenHire?{" "}
          <Link to="/signup" style={{ color: "var(--brand-strong)", fontWeight: 700 }}>
            Join now
          </Link>
        </p>
      </div>
    </div>
  );
}

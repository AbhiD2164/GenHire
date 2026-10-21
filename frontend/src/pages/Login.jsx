import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { firebaseSignIn } from "../api/auth";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { loginWithFirebaseGoogle } from "../utils/firebase";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [firebaseLoading, setFirebaseLoading] = useState(false);
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

  async function handleFirebaseGoogleLogin() {
    setFirebaseLoading(true);
    try {
      const { idToken } = await loginWithFirebaseGoogle();
      await firebaseSignIn({ id_token: idToken });
      await refreshProfile();
      showToast("Signed in via Firebase Auth!", "success");
      navigate("/feed");
    } catch (err) {
      showToast(err.message || "Firebase sign in failed.", "error");
    } finally {
      setFirebaseLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">Unified Access</span>
        <h1>Log in to GenHire</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 28 }}>
          Sign in to your account as a candidate or recruiter.
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

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-color, #2a2f3d)" }} />
            <span className="text-xs muted">OR SIGN IN WITH</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color, #2a2f3d)" }} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleFirebaseGoogleLogin}
              disabled={firebaseLoading}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span>🔥 Firebase Auth</span>
            </button>
            <GoogleSignInButton
              onSuccess={async () => {
                await refreshProfile();
                navigate("/feed");
              }}
            />
          </div>
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

import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { passwordResetConfirm } from "../api/auth";
import { useToast } from "../context/ToastContext";

export default function PasswordResetConfirm() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const hasResetCredentials = Boolean(uid && token);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasResetCredentials) {
      showToast("This reset link is incomplete. Request a new one.", "error");
      return;
    }
    setLoading(true);
    try {
      await passwordResetConfirm({ uid, token, new_password: newPassword });
      showToast("Password reset. Please log in.", "success");
      navigate("/login");
    } catch (err) {
      const passwordErrors = err.response?.data?.new_password;
      const message = Array.isArray(passwordErrors)
        ? passwordErrors.join(" ")
        : err.response?.data?.detail || "Could not reset password.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <h2>Create a new password</h2>
        <p className="muted">
          {hasResetCredentials
            ? "Choose a strong password for your account."
            : "This reset link is incomplete or invalid. Request a new password reset link."}
        </p>
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={!hasResetCredentials}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading || !hasResetCredentials}>
            {loading ? "Saving…" : "Reset password"}
          </button>
          {!hasResetCredentials && <Link to="/forgot-password">Request a new link</Link>}
        </form>
      </div>
    </div>
  );
}

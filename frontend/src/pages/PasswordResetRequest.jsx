import { useState } from "react";
import { passwordResetRequest } from "../api/auth";
import { useToast } from "../context/ToastContext";

export default function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const frontendUrl = window.location.origin + "/reset-password";
      await passwordResetRequest(email, frontendUrl);
      showToast("If an account exists, a reset email was sent.", "success");
    } catch {
      showToast("Could not send reset email.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <h2>Reset your password</h2>
        <p className="muted">Enter the email associated with your account and we'll send instructions.</p>
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
        </form>
      </div>
    </div>
  );
}

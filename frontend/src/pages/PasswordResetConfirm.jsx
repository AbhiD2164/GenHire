import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await passwordResetConfirm({ uid, token, new_password: newPassword });
      showToast("Password reset. Please log in.", "success");
      navigate("/login");
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not reset password.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <h2>Create a new password</h2>
        <p className="muted">Choose a strong password for your account.</p>
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? "Saving…" : "Reset password"}</button>
        </form>
      </div>
    </div>
  );
}

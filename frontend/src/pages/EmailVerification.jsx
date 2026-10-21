import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmEmailVerification, requestEmailVerification } from "../api/auth";
import { useToast } from "../context/ToastContext";

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await confirmEmailVerification(email, code);
      showToast("Email verified. You can now log in.", "success");
      navigate("/login");
    } catch (error) {
      showToast(error.response?.data?.detail || "Could not verify that code.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    try {
      await requestEmailVerification(email);
      showToast("A new verification code was sent.", "success");
    } catch {
      showToast("Could not send a new code.", "error");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">One more step</span>
        <h1>Verify your email</h1>
        <p className="muted">Enter the six-digit code we sent to your registered email address.</p>
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="field">
            <label>Verification code</label>
            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify email"}
          </button>
        </form>
        <button className="btn btn-ghost btn-block" type="button" onClick={resendCode} style={{ marginTop: 10 }}>
          Resend code
        </button>
        <p className="text-sm muted" style={{ marginTop: 18, textAlign: "center" }}>
          Already verified? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

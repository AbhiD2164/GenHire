import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Signup() {
  const [form, setForm] = useState({
    username: "", email: "", password: "", first_name: "", last_name: "", role: "applicant",
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(form);
      showToast("Account created! Please log in.", "success");
      navigate("/login");
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? Object.values(data)[0] : null;
      showToast(Array.isArray(firstError) ? firstError[0] : firstError || "Could not create account.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card auth-card-wide">
        <span className="eyebrow">Get started</span>
        <h1>Create your account</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 28 }}>
          Whether you're hiring or job hunting, any industry, any role.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>I am a…</label>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-option ${form.role === "applicant" ? "active" : ""}`}
                onClick={() => update("role", "applicant")}
              >
                Job seeker
              </button>
              <button
                type="button"
                className={`role-option ${form.role === "recruiter" ? "active" : ""}`}
                onClick={() => update("role", "recruiter")}
              >
                Recruiter
              </button>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>First name</label>
              <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Username</label>
            <input value={form.username} onChange={(e) => update("username", e.target.value)} required />
          </div>

          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
          </div>

          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
            <span className="field-hint">At least 8 characters.</span>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <GoogleSignInButton
            onSuccess={async () => {
              await refreshProfile();
              navigate("/feed");
            }}
          />
        </div>

        <p className="text-sm muted" style={{ marginTop: 20, textAlign: "center" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--amber-deep)", fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

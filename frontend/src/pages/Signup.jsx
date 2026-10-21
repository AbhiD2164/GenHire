import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, firebaseSignIn } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { loginWithFirebaseGoogle } from "../utils/firebase";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "applicant",
    company_name: "",
    company_website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [firebaseLoading, setFirebaseLoading] = useState(false);
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
      showToast("Account created! Check your email for the verification code.", "success");
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? Object.values(data)[0] : null;
      showToast(Array.isArray(firstError) ? firstError[0] : firstError || "Could not create account.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFirebaseGoogleSignup() {
    setFirebaseLoading(true);
    try {
      const { idToken } = await loginWithFirebaseGoogle();
      await firebaseSignIn({
        id_token: idToken,
        role: form.role,
        company_name: form.company_name,
        company_website: form.company_website,
      });
      await refreshProfile();
      showToast("Signed up successfully via Firebase!", "success");
      navigate("/feed");
    } catch (err) {
      showToast(err.message || "Firebase sign up failed.", "error");
    } finally {
      setFirebaseLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card auth-card-wide" style={{ maxWidth: 540 }}>
        <span className="eyebrow">Unified Registration</span>
        <h1>Create your account</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>
          Join GenHire to connect, apply, and hire across all industries.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>I am registering as a…</label>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-option ${form.role === "applicant" ? "active" : ""}`}
                onClick={() => update("role", "applicant")}
              >
                Candidate / Job Seeker
              </button>
              <button
                type="button"
                className={`role-option ${form.role === "recruiter" ? "active" : ""}`}
                onClick={() => update("role", "recruiter")}
              >
                Recruiter / Employer
              </button>
            </div>
          </div>

          {form.role === "recruiter" && (
            <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: "12px 14px", borderRadius: 8, marginBottom: 16, borderLeft: "3px solid #6366f1" }}>
              <strong style={{ fontSize: "0.85rem", color: "#6366f1" }}>Anti-Fake Recruiter Verification</strong>
              <p className="text-xs muted" style={{ margin: "4px 0 0" }}>
                Use your official work email matching your company domain (e.g. <code>you@company.com</code>) to get immediate verified status.
              </p>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>First name</label>
              <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required />
            </div>
            <div className="field">
              <label>Last name</label>
              <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label>Username</label>
            <input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="Choose a unique username" required />
          </div>

          <div className="field">
            <label>{form.role === "recruiter" ? "Official Corporate Email" : "Email Address"}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={form.role === "recruiter" ? "name@company.com" : "name@example.com"}
              required
            />
          </div>

          {form.role === "recruiter" && (
            <div className="field-row">
              <div className="field">
                <label>Company Name</label>
                <input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="e.g. Stripe, Inc."
                  required
                />
              </div>
              <div className="field">
                <label>Company Website</label>
                <input
                  value={form.company_website}
                  onChange={(e) => update("company_website", e.target.value)}
                  placeholder="https://company.com"
                  required
                />
              </div>
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
            <span className="field-hint">At least 8 characters.</span>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-color, #2a2f3d)" }} />
            <span className="text-xs muted">OR SIGN UP WITH</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color, #2a2f3d)" }} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleFirebaseGoogleSignup}
              disabled={firebaseLoading}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span>🔥 Firebase Google Auth</span>
            </button>
            <GoogleSignInButton
              onSuccess={async () => {
                await refreshProfile();
                navigate("/feed");
              }}
              role={form.role}
            />
          </div>
        </div>

        <p className="text-sm muted" style={{ marginTop: 20, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

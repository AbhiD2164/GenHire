import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, firebaseSignIn } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { loginWithFirebaseGoogle } from "../utils/firebase";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone_number: "",
    password: "",
    first_name: "",
    last_name: "",
    headline: "",
    industry: "Information Technology",
    location: "",
    company_name: "",
    company_website: "",
  });
  const [showCompanyFields, setShowCompanyFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.phone_number.trim()) {
      showToast("Please enter a valid mobile number for contact verification.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await signup(form);
      showToast("Account created! A 6-digit verification code has been sent to your email.", "success");
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? Object.values(data)[0] : null;
      showToast(Array.isArray(firstError) ? firstError[0] : firstError || "Could not create account.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleAuth() {
    setGoogleLoading(true);
    try {
      const { idToken } = await loginWithFirebaseGoogle();
      await firebaseSignIn({
        id_token: idToken,
        company_name: form.company_name,
        company_website: form.company_website,
      });
      await refreshProfile();
      showToast("Signed in successfully!", "success");
      navigate("/feed");
    } catch (err) {
      showToast(err.message || "Google authentication failed. Please use email & password.", "error");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card" style={{ maxWidth: 580, width: "100%", margin: "24px auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span className="eyebrow" style={{ margin: "0 auto 6px" }}>Unified Registration</span>
          <h1 style={{ fontSize: 24, margin: "0 0 6px", fontWeight: 800 }}>Create Your GenHire Account</h1>
          <p className="muted text-sm" style={{ margin: 0 }}>
            One account to search open roles, connect with peers, or hire for your company.
          </p>
        </div>

        {/* Unified Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleAuth}
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
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span className="text-xs muted font-semibold">OR REGISTER WITH EMAIL & MOBILE</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name Row */}
          <div className="field-row">
            <div className="field">
              <label>First Name</label>
              <input
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          {/* Username & Mobile */}
          <div className="field-row">
            <div className="field">
              <label>Username</label>
              <input
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="johndoe"
                required
              />
            </div>
            <div className="field">
              <label>Mobile / Phone Number</label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(e) => update("phone_number", e.target.value)}
                placeholder="+1 555-0199 or +91 9876543210"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Industry & Location */}
          <div className="field-row">
            <div className="field">
              <label>Industry</label>
              <select
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--paper)" }}
              >
                <option value="Information Technology">Information Technology & Software</option>
                <option value="Healthcare & Nursing">Healthcare, Medical & Nursing</option>
                <option value="Finance & Accounting">Finance, Banking & Accounting</option>
                <option value="Engineering & Manufacturing">Engineering & Manufacturing</option>
                <option value="Sales & Marketing">Sales, Marketing & Growth</option>
                <option value="Human Resources">Human Resources & Recruitment</option>
                <option value="Legal & Compliance">Legal & Compliance</option>
                <option value="Operations & Logistics">Operations & Supply Chain</option>
                <option value="Education & Academia">Education & Training</option>
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="City, Country (e.g. Austin, TX)"
              />
            </div>
          </div>

          {/* Headline */}
          <div className="field">
            <label>Professional Headline</label>
            <input
              value={form.headline}
              onChange={(e) => update("headline", e.target.value)}
              placeholder="e.g. Software Engineer, Registered Nurse, Financial Analyst, or Founder"
            />
          </div>

          {/* Optional Company Affiliation */}
          <div style={{ margin: "10px 0 14px" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCompanyFields(!showCompanyFields)}
              style={{ padding: "4px 8px", fontSize: 12.5 }}
            >
              {showCompanyFields ? "− Hide Company / Employer Details" : "+ Hiring or representing a company? (Optional)"}
            </button>
          </div>

          {showCompanyFields && (
            <div className="field-row" style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 14 }}>
              <div className="field">
                <label>Company Name</label>
                <input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div className="field">
                <label>Company Website</label>
                <input
                  value={form.company_website}
                  onChange={(e) => update("company_website", e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? "Creating Account..." : "Register & Send Email OTP"}
          </button>
        </form>

        <p className="text-sm muted" style={{ marginTop: 20, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--brand-strong)", fontWeight: 700 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { analyzeResume } from "../api/ats";
import { useToast } from "../context/ToastContext";
import ResumeScoreCard from "../components/ResumeScoreCard";
import SuggestionsList from "../components/SuggestionsList";

export default function ResumeAnalysis() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return showToast("Please upload a PDF or Word document.", "error");

    const validExtensions = [".pdf", ".doc", ".docx"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      return showToast("Only Word (.doc, .docx) and PDF files are acceptable.", "error");
    }

    setLoading(true);
    try {
      const data = await analyzeResume({ resumeFile: file, jobId: jobId || undefined });
      setResult(data);
      showToast("Resume analysis successfully computed!", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Analysis failed. Please check file format.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page container" style={{ paddingTop: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <span className="eyebrow" style={{ margin: 0 }}>Intelligent Multi-Industry ATS</span>
        <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800 }}>Resume Scanner & Analysis</h1>
        <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
          Evaluates resumes across Healthcare, Finance, Engineering, Sales, HR, Legal, and Tech with automated anti-phishing format verification.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "flex-start" }}>
        {/* Left Column: Upload Form & Results */}
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label style={{ fontWeight: 700 }}>Upload Resume Document</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ padding: "8px 0" }}
                />
                <span className="text-xs muted" style={{ display: "block", marginTop: 4 }}>
                  Strict formatting enforced: Only .PDF and .DOCX files accepted. Phishing URLs and malformed layouts are automatically rejected.
                </span>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Optional: Compare against specific Job ID</label>
                <input
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="e.g. 101 (Leave empty to trigger general multi-industry detection)"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? "Analyzing Document..." : "Scan & Analyze Resume"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                    setJobId("");
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Analysis Results Display */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Score and Overview */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Evaluation Results</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="badge" style={{ background: "#DCFCE7", color: "#166534", fontWeight: 700 }}>
                      ✓ Format & Security Verified
                    </span>
                    <span className="badge" style={{ background: "#E0F2FE", color: "#0369A1", fontWeight: 700 }}>
                      {result.detected_industry || "General Industry"}
                    </span>
                  </div>
                </div>

                <ResumeScoreCard score={result.score} />

                {/* Friendly Natural Feedback */}
                {result.user_friendly_summary && (
                  <div
                    style={{
                      background: "#F8FAFC",
                      borderLeft: "4px solid var(--brand-strong)",
                      padding: "12px 16px",
                      borderRadius: 6,
                      marginTop: 16,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Summary & Impact: </strong>
                    <span>{result.user_friendly_summary}</span>
                  </div>
                )}

                {/* Quantified Metrics Info */}
                <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 13 }} className="muted">
                  <span>
                    <strong>Quantified Achievements: </strong>
                    {result.quantified_achievements ?? 0} data-driven points detected
                  </span>
                  <span>
                    <strong>Industry Domain: </strong>
                    {result.detected_industry || "Information Technology"}
                  </span>
                </div>
              </div>

              {/* Tailored Job Description for this Candidate */}
              {result.tailored_job_description && (
                <div className="card" style={{ padding: 22 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>
                    Tailored Job Description (Generated for Your Profile)
                  </h3>
                  <p className="text-xs muted" style={{ margin: "0 0 14px" }}>
                    Synthesized from your detected industry domain and demonstrated skill patterns:
                  </p>
                  <div
                    style={{
                      background: "#F8FAFC",
                      padding: 16,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--ink)",
                    }}
                  >
                    {result.tailored_job_description}
                  </div>
                </div>
              )}

              {/* Skills breakdown by Domain */}
              <div className="card" style={{ padding: 22 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Detected Competencies & Keywords</h3>
                {result.skills_by_domain && Object.keys(result.skills_by_domain).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {Object.entries(result.skills_by_domain).map(([domain, skills]) => (
                      <div key={domain}>
                        <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "var(--slate)" }}>
                          {domain}
                        </h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {skills.map((s) => (
                            <span
                              key={s}
                              className="badge"
                              style={{ background: "#F1F5F9", color: "var(--ink)", fontSize: 12, padding: "4px 8px" }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.present_skills?.map((s) => (
                      <span key={s} className="badge" style={{ background: "#F1F5F9", color: "var(--ink)" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actionable Improvement Tips */}
              {result.tips && result.tips.length > 0 && (
                <div className="card" style={{ padding: 22 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Actionable Recommendations</h3>
                  <SuggestionsList suggestions={result.tips} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: ATS Guidance & Tips */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>ATS Screening Standards</h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: "var(--slate)" }}>
              <li><strong>Score 80–100%:</strong> Immediate candidate selection and recruiter notification.</li>
              <li><strong>Score 60–79%:</strong> Partial match; forwarded for manual recruiter consideration.</li>
              <li><strong>Score &lt; 60%:</strong> Instant rejection with transparent feedback email.</li>
            </ul>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Format & Security Integrity</h4>
            <p className="text-xs muted" style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
              GenHire strictly scans for security threats and malformed formatting:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--slate)" }}>
              <div>✓ Word (.doc, .docx) and PDF (.pdf) only</div>
              <div>✓ Malicious & phishing URLs blocked</div>
              <div>✓ Clean plaintext structure required</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

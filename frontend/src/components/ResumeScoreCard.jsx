import React from "react";

export default function ResumeScoreCard({ score }) {
  const pct = score == null ? null : Math.round(score * 100);
  const status = pct == null ? "Unknown" : pct >= 70 ? "Strong" : pct >= 40 ? "Consider" : "Weak";

  const colorClass = pct == null ? "status-pending" : pct >= 70 ? "status-selected" : pct >= 40 ? "status-consider" : "status-rejected";

  return (
    <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: 12, background: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
        {pct == null ? "—" : `${pct}%`}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{status}</div>
          <div className={`status-pill ${colorClass}`} style={{ fontWeight: 800 }}>{colorClass.replace("status-", "").toUpperCase()}</div>
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Estimated ATS match score based on role skills and resume content.</div>
      </div>
    </div>
  );
}

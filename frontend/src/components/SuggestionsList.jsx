import React from "react";

export default function SuggestionsList({ suggestions }) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div className="muted">No suggestions. Your resume looks fine for the checked role.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <h4 style={{ marginBottom: 8 }}>Suggestions</h4>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {suggestions.map((s, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{s.tip || Object.values(s).join(", ")}</div>
            {s.missing_required_skills && (
              <div className="muted" style={{ marginTop: 4 }}>{`Missing: ${s.missing_required_skills.join(", ")}`}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

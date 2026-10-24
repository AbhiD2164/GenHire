import React from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/feed";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "40px 20px",
            textAlign: "center",
            fontFamily: "var(--font-sans, sans-serif)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "var(--ink, #0f172a)" }}>
            Something went wrong while loading this page
          </h2>
          <p style={{ fontSize: 14, color: "var(--slate, #64748b)", maxWidth: 440, margin: "0 auto 20px" }}>
            An unexpected render issue occurred. Your session and account data remain completely safe.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={this.handleReset}
              style={{
                padding: "8px 18px",
                background: "var(--brand, #0ea5e9)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Return to Feed
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

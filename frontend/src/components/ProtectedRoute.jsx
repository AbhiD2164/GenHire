import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roleRequired }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (roleRequired && profile.role !== roleRequired) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

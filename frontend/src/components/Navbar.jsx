import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function isActive(path) {
    return location.pathname === path ? "navlink active" : "navlink";
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to={profile ? "/feed" : "/"} className="brand">
          <span className="brand-mark">G</span>
          <span className="brand-text">GenHire</span>
        </Link>

        {profile && (
          <nav className="nav-links">
            <Link to="/feed" className={isActive("/feed")}>Feed</Link>
            <Link to="/jobs" className={isActive("/jobs")}>Jobs</Link>
            <Link to="/network" className={isActive("/network")}>Network</Link>
            <Link to="/messages" className={isActive("/messages")}>Messages</Link>
            <Link to="/resume-analysis" className={isActive("/resume-analysis")}>Resume ATS</Link>
            {profile.role === "recruiter" && (
              <Link to="/candidates" className={isActive("/candidates")}>Candidates</Link>
            )}
            <Link to="/dashboard" className={isActive("/dashboard")}>Dashboard</Link>
          </nav>
        )}

        <div className="nav-actions">
          {profile ? (
            <>
              <Link to="/profile" className="nav-avatar-link" title={profile.full_name}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="nav-avatar" />
                ) : (
                  <span className="nav-avatar-fallback">
                    {(profile.full_name || profile.username || "?")[0].toUpperCase()}
                  </span>
                )}
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

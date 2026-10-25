import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCommunityMembershipRequests, getNotifications } from "../api/network";

export default function Navbar() {
  const { profile, logout } = useAuth();
  const [communityRequestCount, setCommunityRequestCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!profile) {
      setCommunityRequestCount(0);
      setNotificationCount(0);
      return undefined;
    }

    let active = true;
    async function refreshCommunityRequests() {
      try {
        const [requests, notifications] = await Promise.all([
          getCommunityMembershipRequests(),
          getNotifications(),
        ]);
        if (active) setCommunityRequestCount(requests.length);
        if (active) setNotificationCount(notifications.unread_count || 0);
      } catch (error) {
        console.error("Could not load community notifications.", error);
      }
    }

    refreshCommunityRequests();
    const intervalId = window.setInterval(refreshCommunityRequests, 60000);
    window.addEventListener("genhire:notifications-updated", refreshCommunityRequests);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("genhire:notifications-updated", refreshCommunityRequests);
    };
  }, [profile]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSearch(event) {
    event.preventDefault();
    const query = searchText.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
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
            <Link to="/people" className={isActive("/people")}>People</Link>
            <Link to="/network" className={isActive("/network")}>Network</Link>
            <Link to="/messages" className={isActive("/messages")}>Messages</Link>
            <Link to="/profile/edit" className={isActive("/profile/edit")}>My Profile</Link>
            <Link to="/resume-analysis" className={isActive("/resume-analysis")}>Resume ATS</Link>
            <Link to="/dashboard" className={isActive("/dashboard")}>Dashboard</Link>
          </nav>
        )}

        <div className="nav-actions">
          {profile ? (
            <>
              <form className="navbar-search" onSubmit={handleSearch} role="search">
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search people, jobs, posts..."
                  aria-label="Search GenHire"
                />
                <button type="submit" aria-label="Submit search">Search</button>
              </form>
              <Link
                to="/notifications"
                className="btn btn-outline btn-sm notification-nav-link"
                aria-label={`${notificationCount} unread notifications`}
              >
                Notifications
                {notificationCount > 0 && <span className="notification-count">{notificationCount}</span>}
              </Link>
              {communityRequestCount > 0 && (
                <Link
                  to="/network"
                  className="btn btn-outline btn-sm"
                  aria-label={`${communityRequestCount} community join requests`}
                >
                  Requests <span className="notification-count">{communityRequestCount}</span>
                </Link>
              )}
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

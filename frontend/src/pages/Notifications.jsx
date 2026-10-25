import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/network";
import { useToast } from "../context/ToastContext";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data.results || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Could not load notifications.", error);
      showToast("Unable to load notifications.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  async function openNotification(notification) {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((items) => items.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        ));
        setUnreadCount((count) => Math.max(0, count - 1));
        window.dispatchEvent(new Event("genhire:notifications-updated"));
      } catch (error) {
        console.error("Could not mark notification as read.", error);
        showToast("Could not update this notification.", "error");
        return;
      }
    }
    if (notification.target_url) navigate(notification.target_url);
  }

  async function markAllRead() {
    setUpdating(true);
    try {
      await markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event("genhire:notifications-updated"));
    } catch (error) {
      console.error("Could not mark notifications as read.", error);
      showToast("Could not update notifications.", "error");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="page container">
      <div className="page-header">
        <div>
          <span className="eyebrow">Your activity</span>
          <h1>Notifications</h1>
          <p className="muted">Connection activity, community requests, and job application updates.</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={updating}>
            {updating ? "Updating…" : "Mark all as read"}
          </button>
        )}
      </div>
      <div className="card notification-list">
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <h3>You’re all caught up</h3>
            <p className="muted">New connection, community, and job activity will appear here.</p>
          </div>
        ) : notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`notification-row ${notification.is_read ? "" : "unread"}`}
            onClick={() => openNotification(notification)}
          >
            <span className="notification-dot" aria-hidden="true" />
            <span className="notification-copy">
              <strong>{notification.title}</strong>
              <span>{notification.body}</span>
              <small>
                {notification.actor_name ? `${notification.actor_name} · ` : ""}
                {new Date(notification.created_at).toLocaleString()}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

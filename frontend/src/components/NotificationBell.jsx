import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getReadNotifications, markNotificationsRead } from "../utils/storage.js";
import { getNotifications, markAllNotificationsRead } from "../services/api.js";

export default function NotificationBell({ role, studentId, complaints = [], payments = [], outside = [], announcements = [] }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(getReadNotifications());
  const [serverItems, setServerItems] = useState([]);

  const loadServerItems = async () => {
    try { setServerItems(await getNotifications()); } catch { setServerItems([]); }
  };
  useEffect(() => { loadServerItems(); }, []);

  const notifications = useMemo(() => {
    const announcementItems = announcements.map((item) => ({
      id: `announcement-${item.announcement_id}`,
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
      type: "Announcement",
      audience: "all"
    }));

    const statusItems = [];
    const ownComplaints = role === "student" ? complaints.filter((item) => item.student_id === studentId) : complaints;
    const ownPayments = role === "student" ? payments.filter((item) => item.student_id === studentId) : payments;

    ownComplaints
      .filter((item) => item.status && item.status !== "pending")
      .forEach((item) =>
        statusItems.push({
          id: `complaint-${item.complaint_id}-${item.status}`,
          title: "Complaint update",
          message: `Complaint #${item.complaint_id} is ${item.status}.`,
          createdAt: item.created_at || new Date().toISOString(),
          type: "Complaint"
        })
      );

    ownPayments
      .filter((item) => item.status === "pending")
      .forEach((item) =>
        statusItems.push({
          id: `payment-${item.payment_id}`,
          title: "Payment reminder",
          message: `Payment of Rs. ${item.amount} is pending.`,
          createdAt: item.payment_date || new Date().toISOString(),
          type: "Payment"
        })
      );

    if (role === "admin" && outside.length) {
      statusItems.push({
        id: "outside-count",
        title: "Students outside",
        message: `${outside.length} student${outside.length > 1 ? "s are" : " is"} currently outside hostel.`,
        createdAt: new Date().toISOString(),
        type: "Outpass"
      });
    }

    const serverNotifications = serverItems.map((item) => ({
      id: `server-${item.notification_id}`,
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
      type: item.notification_type,
      isRead: Boolean(item.read_at)
    }));
    const serverAnnouncementTitles = new Set(serverNotifications.filter((item) => item.type === "announcement").map((item) => item.title));
    return [...serverNotifications, ...announcementItems.filter((item) => !serverAnnouncementTitles.has(item.title)), ...statusItems].sort(
      (a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
    );
  }, [role, studentId, complaints, payments, outside, announcements, serverItems]);

  const unreadCount = notifications.filter((item) => item.isRead === false || (item.isRead === undefined && !readIds.includes(item.id))).length;

  const markAllRead = async () => {
    const ids = notifications.map((item) => item.id);
    markNotificationsRead(ids);
    setReadIds(ids);
    await markAllNotificationsRead().catch(() => {});
    await loadServerItems();
  };

  return (
    <div className="notification-shell">
      <button className="icon-button bell-button" type="button" onClick={() => { setOpen((value) => !value); loadServerItems(); }} aria-label="Open notifications">
        <Bell size={19} />
        {unreadCount > 0 ? <span>{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notification-menu">
          <div className="notification-head">
            <strong>Notifications</strong>
            <button type="button" onClick={markAllRead}>
              <CheckCheck size={15} /> Mark read
            </button>
          </div>
          <div className="notification-list">
            {notifications.length ? (
              notifications.map((item) => (
                <article className={item.isRead === false || (item.isRead === undefined && !readIds.includes(item.id)) ? "unread" : ""} key={item.id}>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </article>
              ))
            ) : (
              <p className="muted compact">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

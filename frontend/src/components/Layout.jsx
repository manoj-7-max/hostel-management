import { BellRing, BriefcaseBusiness, Building2, CalendarCheck2, ChartNoAxesCombined, ClipboardList, CreditCard, Home, LogOut, Megaphone, Menu, Package, Utensils, Users, UserCog, GitBranch, FileText, UserRoundCheck, Wrench, ReceiptIndianRupee } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getStoredHostelId, setStoredHostelId } from "../utils/storage.js";
import { getHostels } from "../services/api.js";
import NotificationBell from "./NotificationBell.jsx";

const adminItems = [
  ["overview", Home, "Overview"],
  ["students", Users, "Students"],
  ["rooms", Building2, "Rooms"],
  ["complaints", ClipboardList, "Complaints"],
  ["payments", CreditCard, "Billing & payments"],
  ["menu-admin", Utensils, "Mess menu"],
  ["outpass", BellRing, "Outpass"],
  ["announcements", Megaphone, "Announcements"],
  ["attendance", CalendarCheck2, "Attendance"],
  ["staff", BriefcaseBusiness, "Staff"],
  ["inventory", Package, "Inventory"],
  ["reports", ChartNoAxesCombined, "Reports"],
  ["team", UserCog, "Team access"],
  ["branches", GitBranch, "Branches & floors"],
  ["admissions", FileText, "Admissions"],
  ["visitors", UserRoundCheck, "Visitors"],
  ["maintenance", Wrench, "Maintenance"],
  ["meals", Utensils, "Meals & subscriptions"],
  ["expenses", ReceiptIndianRupee, "Expenses"]
];

const studentItems = [
  ["overview", Home, "Overview"],
  ["complaints", ClipboardList, "Complaints"],
  ["payments", CreditCard, "Payments"],
  ["attendance", CalendarCheck2, "Attendance"],
  ["menu", Utensils, "Mess Menu"],
  ["outpass", BellRing, "Outpass"]
];

const parentItems = [
  ["overview", Home, "Overview"],
  ["attendance", CalendarCheck2, "Attendance"],
  ["invoices", CreditCard, "Invoices"],
  ["leave", BellRing, "Leave status"],
  ["announcements", Megaphone, "Announcements"]
];

export default function Layout({ role, activeTab, setActiveTab, children, notificationData }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hostelId, setHostelId] = useState(getStoredHostelId() || String(user?.hostels?.[0]?.hostel_id || ""));
  const [hostels, setHostels] = useState(user?.hostels || []);
  useEffect(() => {
    if (role !== "admin") return;
    getHostels().then((rows) => {
      setHostels(rows);
      if (!hostelId && rows[0]) {
        setHostelId(String(rows[0].hostel_id));
        setStoredHostelId(rows[0].hostel_id);
      }
    }).catch(() => {});
  }, [role]);
  const permissions = new Set(user?.permissions || []);
  const permissionFor = {
    students: "students.read", rooms: "rooms.read", complaints: "complaints.read",
    payments: "fees.read", "menu-admin": "mess.manage", outpass: "leave.manage",
    announcements: "announcements.read", attendance: "attendance.read", staff: "staff.manage",
    inventory: "inventory.manage", reports: "reports.read", team: "users.manage", branches: "hostels.manage",
    admissions: "students.read", visitors: "visitors.manage", maintenance: "maintenance.manage",
    meals: "mess.manage", expenses: "reports.read"
  };
  const items = (role === "admin" ? adminItems : role === "parent" ? parentItems : studentItems).filter(([id]) =>
    role !== "admin" || id === "overview" || permissions.has(permissionFor[id])
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <Building2 size={28} />
          <div>
            <strong>HostelMS</strong>
            <span>{role === "admin" ? "Admin Console" : role === "parent" ? "Family Portal" : "Student Portal"}</span>
          </div>
        </div>
        <nav>
          {items.map(([id, Icon, label]) => (
            <button
              className={activeTab === id ? "active" : ""}
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <button className="logout-button" type="button" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <div>
            <span className="eyebrow">{role === "admin" ? "Operations dashboard" : role === "parent" ? "Family portal" : "My hostel dashboard"}</span>
            <h1>{role === "admin" ? "Hostel Management" : `Welcome${user?.name ? `, ${user.name}` : ""}`}</h1>
          </div>
          <div className="topbar-actions">
            {hostels.length > 1 ? (
              <label className="hostel-switcher">
                <span>Hostel</span>
                <select value={hostelId} onChange={(event) => {
                  const value = event.target.value;
                  setHostelId(value);
                  setStoredHostelId(value);
                  window.location.reload();
                }} aria-label="Active hostel">
                  {hostels.map((hostel) => <option key={hostel.hostel_id} value={hostel.hostel_id}>{hostel.hostel_name}</option>)}
                </select>
              </label>
            ) : null}
            <NotificationBell role={role} studentId={user?.student_id} {...notificationData} />
            <div className="avatar">{user?.name?.[0] || user?.email?.[0] || "U"}</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

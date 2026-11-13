import { useEffect, useState } from "react";
import { CalendarCheck2, CreditCard, Megaphone, UserRound } from "lucide-react";
import DataTable from "../components/DataTable.jsx";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import { getChildAnnouncements, getChildAttendance, getChildInvoices, getChildLeave, getParentChildren } from "../services/api.js";

export default function ParentDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [children, setChildren] = useState([]); const [selectedId, setSelectedId] = useState("");
  const [attendance, setAttendance] = useState([]); const [invoices, setInvoices] = useState([]); const [announcements, setAnnouncements] = useState([]);
  const [leave, setLeave] = useState([]);
  const [error, setError] = useState("");

  const loadChildren = async () => {
    try {
      const rows = await getParentChildren(); setChildren(rows);
      if (!rows.some((item) => String(item.student_id) === String(selectedId))) setSelectedId(String(rows[0]?.student_id || ""));
    } catch (err) { setError(err.response?.data?.error || "Unable to load linked resident accounts."); }
  };

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => {
    if (!selectedId) return;
    Promise.all([getChildAttendance(selectedId), getChildInvoices(selectedId), getChildAnnouncements(selectedId), getChildLeave(selectedId)])
      .then(([a,i,n,l]) => { setAttendance(a); setInvoices(i); setAnnouncements(n); setLeave(l); setError(""); })
      .catch((err) => setError(err.response?.data?.error || "Unable to load family account details."));
  }, [selectedId]);

  const child = children.find((item) => String(item.student_id) === String(selectedId));
  return <Layout role="parent" activeTab={activeTab} setActiveTab={setActiveTab}>
    <section className="page-section fade-in">
      <div className="section-toolbar"><div><span className="eyebrow">FAMILY PORTAL</span><h2>{activeTab === "overview" && child ? child.name : activeTab[0].toUpperCase() + activeTab.slice(1)}</h2></div>
        {children.length > 1 ? <label className="child-switcher">Resident<select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{children.map((item) => <option key={item.student_id} value={item.student_id}>{item.name}</option>)}</select></label> : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {!children.length ? <article className="panel"><p className="muted">No resident account is linked to this guardian login in the selected hostel.</p></article> : null}
      {activeTab === "overview" && child ? <>
        <div className="stats-grid"><StatCard label="Resident" value={child.name} icon={UserRound} /><StatCard label="Room" value={child.room_number || "Unassigned"} icon={UserRound} tone="green" /><StatCard label="Attendance records" value={attendance.length} icon={CalendarCheck2} tone="amber" /><StatCard label="Invoices" value={invoices.length} icon={CreditCard} tone="rose" /></div>
        <article className="panel"><div className="panel-head"><h3>Recent notices</h3><Megaphone size={18} /></div><div className="announcement-list">{announcements.slice(0,4).map((item) => <article key={item.announcement_id}><span>{new Date(item.created_at).toLocaleString()}</span><strong>{item.title}</strong><p>{item.message}</p></article>)}{!announcements.length ? <p className="muted">No current announcements.</p> : null}</div></article>
      </> : null}
      {activeTab === "attendance" ? <article className="panel"><div className="panel-head"><h3>{child?.name} · Attendance history</h3></div><DataTable rows={attendance} emptyText="No attendance records are available." columns={[
        { key: "attendance_date", label: "Date" }, { key: "status", label: "Status" }, { key: "note", label: "Note" }
      ]} /></article> : null}
      {activeTab === "invoices" ? <article className="panel"><div className="panel-head"><h3>{child?.name} · Invoices</h3></div><DataTable rows={invoices} emptyText="No invoices are available." columns={[
        { key: "invoice_number", label: "Invoice" }, { key: "billing_period", label: "Period" }, { key: "due_date", label: "Due date" },
        { key: "total_amount", label: "Total", render: (row) => `Rs. ${Number(row.total_amount).toFixed(2)}` },
        { key: "paid_amount", label: "Paid", render: (row) => `Rs. ${Number(row.paid_amount).toFixed(2)}` },
        { key: "balance_due", label: "Balance", render: (row) => `Rs. ${Number(row.balance_due).toFixed(2)}` }, { key: "status", label: "Status" }
      ]} /></article> : null}
      {activeTab === "announcements" ? <article className="panel"><div className="panel-head"><h3>Hostel announcements</h3></div><DataTable rows={announcements} emptyText="No announcements are available." columns={[
        { key: "title", label: "Title" }, { key: "message", label: "Message" }, { key: "created_at", label: "Posted", render: (row) => new Date(row.created_at).toLocaleString() }
      ]} /></article> : null}
      {activeTab === "leave" ? <article className="panel"><div className="panel-head"><h3>{child?.name} · Leave requests</h3></div><DataTable rows={leave} emptyText="No leave requests are available." columns={[
        { key: "reason", label: "Reason" }, { key: "request_time", label: "Requested", render: (row) => new Date(row.request_time).toLocaleString() },
        { key: "status", label: "Status" }, { key: "check_out_time", label: "Departed", render: (row) => row.check_out_time ? new Date(row.check_out_time).toLocaleString() : "—" },
        { key: "check_in_time", label: "Returned", render: (row) => row.check_in_time ? new Date(row.check_in_time).toLocaleString() : "—" }
      ]} /></article> : null}
    </section>
  </Layout>;
}

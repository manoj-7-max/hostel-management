import { BellRing, Building2, CalendarCheck2, ClipboardPlus, CreditCard, UserRound, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  createPayment,
  createComplaint,
  getAnnouncements,
  getMyAttendance,
  getComplaints,
  getMenu,
  getMyProfile,
  getMyRoom,
  getPayments,
  getInvoices,
  markAnnouncementRead,
  requestOutpass
} from "../services/api.js";

const initialStudentPayment = { amount: "", purpose: "mess" };

export default function StudentDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [menu, setMenu] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);
  const [paymentForm, setPaymentForm] = useState(initialStudentPayment);
  const [complaintText, setComplaintText] = useState("");
  const [outpassReason, setOutpassReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, roomData, complaintData, paymentData, menuData, announcementData, attendanceData, invoiceData] = await Promise.all([
        getMyProfile(),
        getMyRoom(),
        getComplaints(),
        getPayments(),
        getMenu(),
        getAnnouncements(),
        getMyAttendance(),
        getInvoices()
      ]);
      setProfile(profileData);
      setRoom(roomData);
      setComplaints(complaintData);
      setPayments(paymentData);
      setInvoices(invoiceData);
      setMenu(menuData);
      setAnnouncements(announcementData);
      setAttendance(attendanceData);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load student dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  const studentId = profile?.student_id || user?.student_id;
  const ownComplaints = complaints;
  const ownPayments = payments;
  const pendingPayments = ownPayments.filter((item) => item.status === "pending");
  const latestAnnouncements = useMemo(() => announcements.slice(0, 6), [announcements]);

  const submitComplaint = async (event) => {
    event.preventDefault();
    if (!studentId) return setError("Student profile was not found for this login email.");
    setError("");
    setMessage("");
    try {
      await createComplaint({ description: complaintText });
      setComplaintText("");
      setMessage("Complaint submitted successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not submit complaint.");
    }
  };

  const submitOutpass = async (event) => {
    event.preventDefault();
    if (!studentId) return setError("Student profile was not found for this login email.");
    setError("");
    setMessage("");
    try {
      await requestOutpass({ reason: outpassReason });
      setOutpassReason("");
      setMessage("Outpass request submitted successfully.");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not request outpass.");
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await createPayment({ amount: Number(paymentForm.amount), purpose: paymentForm.purpose });
      setPaymentForm(initialStudentPayment);
      setMessage("Payment request recorded. The hostel office must confirm it before it is marked paid.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not submit payment.");
    }
  };

  return (
    <Layout role="student" activeTab={activeTab} setActiveTab={setActiveTab} notificationData={{ complaints, payments, outside: [], announcements }}>
      {activeTab === "overview" ? (
        <AnnouncementTicker
          announcements={latestAnnouncements}
          expandedAnnouncement={expandedAnnouncement}
          setExpandedAnnouncement={setExpandedAnnouncement}
          onRead={async (id) => {
            await markAnnouncementRead(id);
            await loadData();
          }}
        />
      ) : null}
      <section className="page-section fade-in">
        <div className="section-toolbar">
          <div>
            <span className="eyebrow">Student self-service</span>
            <h2>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h2>
          </div>
        </div>

        {loading ? <p className="muted">Loading student data...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        {activeTab === "overview" ? (
          <>
            <div className="stats-grid">
              <StatCard label="Complaint tickets" value={ownComplaints.length} icon={BellRing} />
              <StatCard label="Pending payments" value={pendingPayments.length} icon={CreditCard} tone="amber" />
              <StatCard label="Mess items" value={menu.length} icon={Utensils} tone="green" />
              <StatCard label="Assigned room" value={room?.room_number || "-"} icon={Building2} tone="rose" />
            </div>
            <div className="grid-two">
              <ProfilePanel profile={profile} user={user} />
              <article className="panel">
                <div className="panel-head">
                  <h3>Room Details</h3>
                </div>
                {room ? (
                  <dl className="profile-list">
                    <div><dt>Room Number</dt><dd>{room.room_number}</dd></div>
                    <div><dt>Capacity</dt><dd>{room.capacity}</dd></div>
                    <div><dt>Occupancy</dt><dd>{room.occupancy}</dd></div>
                    <div><dt>Allocated On</dt><dd>{room.allocation_date || "-"}</dd></div>
                  </dl>
                ) : (
                  <p className="muted">No room has been assigned yet.</p>
                )}
              </article>
            </div>
          </>
        ) : null}

        {activeTab === "complaints" ? (
          <div className="grid-two">
            <article className="panel">
              <div className="panel-head">
                <h3>Create Complaint</h3>
                <ClipboardPlus size={18} />
              </div>
              <form className="stack-form" onSubmit={submitComplaint}>
                <label>
                  Description
                  <textarea value={complaintText} onChange={(event) => setComplaintText(event.target.value)} rows={5} required />
                </label>
                <button className="primary-button" type="submit">Submit complaint</button>
              </form>
            </article>
            <article className="panel">
              <div className="panel-head">
                <h3>My Complaints</h3>
              </div>
              <DataTable
                rows={ownComplaints}
                columns={[
                  { key: "complaint_id", label: "ID" },
                  { key: "description", label: "Description" },
                  { key: "priority", label: "Priority" },
                  { key: "updates", label: "Updates", render: (row) => row.updates?.length ? <details><summary>{row.updates.length} update{row.updates.length===1?"":"s"}</summary><div className="announcement-list">{row.updates.map((item,index)=><article key={`${row.complaint_id}-${index}`}><span>{new Date(item.created_at).toLocaleString()}</span><strong>{item.old_status||"submitted"} → {item.new_status}</strong>{item.note?<p>{item.note}</p>:null}</article>)}</div></details> : <span className="muted">No updates yet</span> },
                  { key: "status", label: "Status", render: (row) => <Status value={row.status} /> }
                ]}
              />
            </article>
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <>
          <div className="grid-two">
            <article className="panel">
              <div className="panel-head">
                <h3>Submit payment request</h3>
              </div>
              <form className="stack-form" onSubmit={submitPayment}>
                <label>
                  Purpose
                  <select value={paymentForm.purpose} onChange={(event) => setPaymentForm((current) => ({ ...current, purpose: event.target.value }))} required>
                    <option value="mess">Mess</option>
                    <option value="hostel_fee">Hostel Fee</option>
                    <option value="laundry">Laundry</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required />
                </label>
                <button className="primary-button" type="submit">Submit for confirmation</button>
              </form>
            </article>
            <article className="panel">
              <div className="panel-head">
                <h3>My Payments</h3>
              </div>
              <DataTable
                rows={ownPayments}
                columns={[
                  { key: "payment_id", label: "ID" },
                  { key: "purpose", label: "Purpose", render: (row) => formatPurpose(row.purpose) },
                  { key: "amount", label: "Amount", render: (row) => `Rs. ${row.amount}` },
                  { key: "status", label: "Status", render: (row) => <Status value={row.status} /> }
                ]}
              />
            </article>
          </div>
          <article className="panel"><div className="panel-head"><h3>My invoices</h3></div>
            <DataTable rows={invoices} emptyText="There are no invoices for your account." columns={[
              { key: "invoice_number", label: "Invoice" }, { key: "billing_period", label: "Period" }, { key: "due_date", label: "Due date" },
              { key: "total_amount", label: "Total", render: (row) => `Rs. ${Number(row.total_amount).toFixed(2)}` },
              { key: "paid_amount", label: "Paid", render: (row) => `Rs. ${Number(row.paid_amount).toFixed(2)}` },
              { key: "balance_due", label: "Balance", render: (row) => `Rs. ${Number(row.balance_due).toFixed(2)}` },
              { key: "status", label: "Status", render: (row) => <Status value={row.status} /> }
            ]} />
          </article>
          </>
        ) : null}

        {activeTab === "menu" ? (
          <article className="panel">
            <div className="panel-head">
              <h3>Mess Menu</h3>
            </div>
            <DataTable
              rows={menu}
              columns={[
                { key: "day", label: "Day" },
                { key: "meal_type", label: "Meal" },
                { key: "description", label: "Menu" }
              ]}
            />
          </article>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="page-section">
            <div className="stats-grid attendance-summary">
              <StatCard label="Days recorded" value={attendance.length} icon={CalendarCheck2} />
              <StatCard label="Present / late" value={attendance.filter((item) => ["present", "late"].includes(item.status)).length} icon={UserRound} tone="green" />
              <StatCard label="Attendance rate" value={`${attendance.length ? Math.round((attendance.filter((item) => ["present", "late"].includes(item.status)).length / attendance.length) * 100) : 0}%`} icon={CalendarCheck2} tone="amber" />
            </div>
            <article className="panel">
              <div className="panel-head"><h3>My attendance history</h3><span className="muted">Most recent 90 records</span></div>
              <DataTable rows={attendance} emptyText="No attendance records have been posted yet." columns={[
                { key: "attendance_date", label: "Date", render: (row) => new Date(`${row.attendance_date}T00:00:00`).toLocaleDateString() },
                { key: "status", label: "Status", render: (row) => <Status value={row.status} /> },
                { key: "note", label: "Note" }
              ]} />
            </article>
          </div>
        ) : null}

        {activeTab === "outpass" ? (
          <article className="panel narrow-panel">
            <div className="panel-head">
              <h3>Request Outpass</h3>
            </div>
            <form className="stack-form" onSubmit={submitOutpass}>
              <label>
                Reason
                <textarea value={outpassReason} onChange={(event) => setOutpassReason(event.target.value)} rows={5} required />
              </label>
              <button className="primary-button" type="submit">Request outpass</button>
            </form>
          </article>
        ) : null}
      </section>
    </Layout>
  );
}

function ProfilePanel({ profile, user }) {
  return (
    <article className="panel profile-panel">
      <div className="panel-head">
        <h3>My Profile</h3>
        <UserRound size={18} />
      </div>
      <dl className="profile-list">
        <div>
          <dt>Name</dt>
          <dd>{profile?.name || user?.name || "-"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{profile?.email || user?.email || "-"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{profile?.phone || "-"}</dd>
        </div>
        <div>
          <dt>Gender</dt>
          <dd>{profile?.gender || "-"}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{profile?.address || "-"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AnnouncementTicker({ announcements, expandedAnnouncement, setExpandedAnnouncement, onRead }) {
  if (!announcements.length) return null;
  const active = expandedAnnouncement ? announcements.find((item) => item.announcement_id === expandedAnnouncement) : null;

  return (
    <div className="student-announcement-bar">
      <div className="ticker-track">
        {announcements.map((item) => (
          <button
            className={!item.is_read ? "new" : ""}
            key={item.announcement_id}
            type="button"
            onClick={() => setExpandedAnnouncement(item.announcement_id)}
          >
            <strong>{item.title}</strong>
            <span>{item.message}</span>
          </button>
        ))}
      </div>
      {active ? (
        <div className="announcement-expanded">
          <div>
            <strong>{active.title}</strong>
            <p>{active.message}</p>
          </div>
          <button type="button" onClick={() => onRead(active.announcement_id).then(() => setExpandedAnnouncement(null))}>
            Mark read
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Status({ value }) {
  return <span className={`status-pill ${value || "pending"}`}>{value || "pending"}</span>;
}

function formatPurpose(value) {
  return (value || "general").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

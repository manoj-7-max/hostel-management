import { BellRing, Building2, CreditCard, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Layout from "../components/Layout.jsx";
import Modal from "../components/Modal.jsx";
import StatCard from "../components/StatCard.jsx";
import Attendance from "./admin/Attendance.jsx";
import Inventory from "./admin/Inventory.jsx";
import MessMenu from "./admin/MessMenu.jsx";
import Reports from "./admin/Reports.jsx";
import Staff from "./admin/Staff.jsx";
import Administration from "./admin/Administration.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import Admissions from "./admin/Admissions.jsx";
import Visitors from "./admin/Visitors.jsx";
import Maintenance from "./admin/Maintenance.jsx";
import Finance from "./admin/Finance.jsx";
import Meals from "./admin/Meals.jsx";
import Expenses from "./admin/Expenses.jsx";
import {
  allocateRoom,
  approveOutpass,
  checkinOutpass,
  checkoutOutpass,
  createAnnouncement,
  createPayment,
  createRoom,
  createStudent,
  checkoutStudent,
  deleteStudent,
  getComplaints,
  getAnnouncements,
  getCurrentlyOutside,
  getOutpasses,
  getPayments,
  getRooms,
  getStudentsPage,
  getAllocationHistory,
  transferStudent,
  updateComplaint
} from "../services/api.js";

const initialStudent = { name: "", email: "", phone: "", gender: "Male", dob: "", address: "", password: "" };
const initialRoom = { room_number: "", capacity: "" };
const initialPayment = { student_id: "", amount: "", purpose: "mess", status: "pending" };
const initialAllocation = { student_id: "", room_id: "" };
const initialAnnouncement = { title: "", message: "" };
const expandedTabs = ["attendance", "staff", "inventory", "reports", "menu-admin", "team", "branches", "admissions", "visitors", "maintenance", "payments", "meals", "expenses"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [rooms, setRooms] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [payments, setPayments] = useState([]);
  const [outside, setOutside] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [studentForm, setStudentForm] = useState(initialStudent);
  const [roomForm, setRoomForm] = useState(initialRoom);
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [allocationForm, setAllocationForm] = useState(initialAllocation);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [transferResident, setTransferResident] = useState(null);
  const [transferRoomId, setTransferRoomId] = useState("");
  const [historyResident, setHistoryResident] = useState(null);
  const [allocationHistory, setAllocationHistory] = useState([]);
  const [settlementNotice, setSettlementNotice] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const permissions = new Set(user?.permissions || []);
      const [studentResult, roomData, complaintData, paymentData, outsideData, announcementData, leaveData] = await Promise.all([
        permissions.has("students.read") ? getStudentsPage(studentPage, 50, studentSearch) : { data: [], total: 0, total_pages: 0 },
        permissions.has("rooms.read") ? getRooms() : [],
        permissions.has("complaints.read") ? getComplaints() : [],
        permissions.has("fees.read") || permissions.has("fees.manage") ? getPayments() : [],
        permissions.has("leave.manage") ? getCurrentlyOutside() : [],
        permissions.has("announcements.read") ? getAnnouncements() : [],
        permissions.has("leave.manage") ? getOutpasses() : []
      ]);
      setStudents(studentResult.data);
      setStudentTotal(studentResult.total);
      setRooms(roomData);
      setComplaints(complaintData);
      setPayments(paymentData);
      setOutside(outsideData);
      setLeaveRequests(leaveData);
      setAnnouncements(announcementData);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [user?.permissions, studentPage, studentSearch]);

  const stats = useMemo(
    () => ({
      students: studentTotal,
      rooms: rooms.length,
      complaints: complaints.filter((item) => item.status === "pending").length,
      outside: outside.length
    }),
    [studentTotal, rooms, complaints, outside]
  );

  const handleSubmit = async (event, action, reset, close = true) => {
    event.preventDefault();
    setError("");
    try {
      await action();
      reset?.();
      if (close) setModal("");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Action failed.");
    }
  };

  const handleComplaintStatus = async (complaintId, status) => {
    setError("");
    try {
      await updateComplaint(complaintId, { status });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not update complaint status.");
    }
  };

  return (
    <Layout role="admin" activeTab={activeTab} setActiveTab={setActiveTab} notificationData={{ complaints, payments, outside, announcements }}>
      <section className="page-section fade-in">
        <div className="section-toolbar">
          {!expandedTabs.includes(activeTab) ? <div>
            <span className="eyebrow">Live hostel control center</span>
            <h2>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h2>
          </div> : <span />}
          {activeTab === "announcements" && user?.permissions?.includes("announcements.manage") ? (
            <button className="primary-button compact-button" type="button" onClick={() => setModal("announcement")}>
              Create Announcement
            </button>
          ) : null}
        </div>

        {!expandedTabs.includes(activeTab) && error ? <p className="form-error">{error}</p> : null}
        {settlementNotice ? <p className="form-success">{settlementNotice}</p> : null}
        {!expandedTabs.includes(activeTab) && loading ? <p className="muted">Loading dashboard data...</p> : null}

        {activeTab === "overview" ? (
          <>
            <div className="stats-grid">
              <StatCard label="Students" value={stats.students} icon={Users} />
              <StatCard label="Rooms" value={stats.rooms} icon={Building2} tone="green" />
              <StatCard label="Pending complaints" value={stats.complaints} icon={BellRing} tone="amber" />
              <StatCard label="Currently outside" value={stats.outside} icon={CreditCard} tone="rose" />
            </div>
            <div className="grid-two">
              <Panel title="Recent Complaints">
                <DataTable
                  rows={complaints.slice(0, 5)}
                  columns={[
                    { key: "complaint_id", label: "ID" },
                    { key: "student_name", label: "Student", render: (row) => row.student_name || `#${row.student_id}` },
                    { key: "room_number", label: "Room" },
                    { key: "description", label: "Description" },
                    { key: "status", label: "Status", render: (row) => <Status value={row.status} /> }
                  ]}
                />
              </Panel>
              <Panel title="Rooms">
                <DataTable
                  rows={rooms.slice(0, 5)}
                  columns={[
                    { key: "room_number", label: "Room" },
                    { key: "capacity", label: "Capacity" },
                    { key: "current_occupancy", label: "Occupied" }
                  ]}
                />
              </Panel>
            </div>
          </>
        ) : null}

        {activeTab === "students" ? (
          <Panel
            title="Students"
            action={
              <div className="button-row student-toolbar">
                <input aria-label="Search residents" placeholder="Search residents" value={studentSearchInput} onChange={(event) => setStudentSearchInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (setStudentPage(1), setStudentSearch(studentSearchInput.trim()))} />
                <button className="secondary-button" type="button" onClick={() => { setStudentPage(1); setStudentSearch(studentSearchInput.trim()); }} >Search</button>
                {user?.permissions?.includes("students.manage") ? <button className="secondary-button" type="button" onClick={() => setModal("student")}><Plus size={16} /> Add Student</button> : null}
              </div>
            }
          >
            <DataTable
              rows={students}
              columns={[
                { key: "student_id", label: "ID" },
                { key: "name", label: "Name" },
                { key: "room_number", label: "Room" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "gender", label: "Gender" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div className="button-row">
                      {user?.permissions?.includes("allocations.manage") ? <>
                        {row.room_number ? <button className="text-button" type="button" onClick={() => { setTransferResident(row); setTransferRoomId(""); setModal("transfer"); }}>Transfer</button> : null}
                        <button className="text-button danger" type="button" onClick={async () => {
                          if (!window.confirm(`Check out ${row.name} and release their current bed?`)) return;
                          setError(""); setSettlementNotice("");
                          try { const result=await checkoutStudent(row.student_id); setSettlementNotice(`Checked out ${row.name}. Outstanding balance: ₹${Number(result.settlement.balance_due).toLocaleString("en-IN")}; refundable security deposit: ₹${Number(result.settlement.refundable_deposit).toLocaleString("en-IN")}.`); await loadData(); }
                          catch (err) { setError(err.response?.data?.error || "Unable to check out resident."); }
                        }}>Check out</button>
                      </> : null}
                      <button className="text-button" type="button" onClick={async () => { try { setHistoryResident(row); setAllocationHistory(await getAllocationHistory(row.student_id)); setModal("history"); } catch (err) { setError(err.response?.data?.error || "Unable to load allocation history."); } }}>History</button>
                      {user?.permissions?.includes("students.manage") ? <button className="text-button danger" type="button" onClick={() => handleSubmit({ preventDefault() {} }, () => deleteStudent(row.student_id))}>Delete</button> : null}
                    </div>
                  )
                }
              ]}
            />
            <div className="pagination-bar">
              <span>{studentTotal ? `${(studentPage - 1) * 50 + 1}–${Math.min(studentPage * 50, studentTotal)} of ${studentTotal} residents` : "No residents found"}</span>
              <div className="button-row">
                <button className="secondary-button compact-button" type="button" disabled={studentPage <= 1} onClick={() => setStudentPage((page) => page - 1)}>Previous</button>
                <button className="secondary-button compact-button" type="button" disabled={studentPage * 50 >= studentTotal} onClick={() => setStudentPage((page) => page + 1)}>Next</button>
              </div>
            </div>
          </Panel>
        ) : null}

        {activeTab === "rooms" ? (
          <Panel
            title="Rooms & Allocation"
            action={
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => setModal("room")}>
                  <Plus size={16} /> Add Room
                </button>
                <button className="secondary-button" type="button" onClick={() => setModal("allocation")}>
                  Allocate Room
                </button>
              </div>
            }
          >
            <DataTable
              rows={rooms.filter((room) => Number(room.current_occupancy) > 0)}
              columns={[
                { key: "room_number", label: "Room" },
                { key: "capacity", label: "Capacity" },
                { key: "current_occupancy", label: "Occupied" }
              ]}
              emptyText="No occupied rooms yet."
            />
          </Panel>
        ) : null}

        {activeTab === "complaints" ? (
          <Panel title="Complaints">
            <DataTable
              rows={complaints}
              columns={[
                { key: "complaint_id", label: "ID" },
                { key: "student_name", label: "Student", render: (row) => row.student_name || `#${row.student_id}` },
                { key: "room_number", label: "Room" },
                { key: "description", label: "Description" },
                { key: "priority", label: "Priority" },
                { key: "status", label: "Status", render: (row) => <Status value={row.status} /> },
                { key: "updates", label: "History", render: (row) => <ComplaintUpdates row={row} /> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    row.status === "pending" ? (
                      <div className="button-row">
                        <button className="text-button" type="button" onClick={() => handleComplaintStatus(row.complaint_id, "in_progress")}>In progress</button>
                        <button className="text-button" type="button" onClick={() => handleComplaintStatus(row.complaint_id, "resolved")}>Resolve</button>
                      </div>
                    ) : (
                      <span className="muted">No action</span>
                    )
                  )
                }
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "payments" ? <Finance /> : null}

        {activeTab === "outpass" ? (
          <Panel title="Leave requests & departures">
            <DataTable
              rows={leaveRequests}
              emptyText="No leave requests recorded for this branch yet."
              columns={[
                { key: "outpass_id", label: "ID" },
                { key: "name", label: "Student" },
                { key: "room_number", label: "Room" },
                { key: "reason", label: "Reason" },
                { key: "status", label: "Status", render: (row) => <Status value={row.status} /> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    row.status === "pending" ? <div className="button-row">
                      <button className="text-button" type="button" onClick={() => approveOutpass(row.outpass_id, { status: "approved" }).then(loadData)}>Approve</button>
                      <button className="text-button danger" type="button" onClick={() => approveOutpass(row.outpass_id, { status: "rejected" }).then(loadData)}>Reject</button>
                    </div> : row.status === "approved" && !row.check_out_time ? <button className="text-button" type="button" onClick={() => checkoutOutpass(row.outpass_id).then(loadData)}>Check out</button>
                      : row.check_out_time && !row.check_in_time ? <button className="text-button" type="button" onClick={() => checkinOutpass(row.outpass_id).then(loadData)}>Check in</button>
                        : <span className="muted">Complete</span>
                  )
                }
              ]}
            />
          </Panel>
        ) : null}

        {activeTab === "announcements" ? (
          <div className="grid-two">
            {user?.permissions?.includes("announcements.manage") ? <Panel title="Create Broadcast">
              <form className="stack-form" onSubmit={(event) => handleSubmit(event, () => createAnnouncement(announcement), () => setAnnouncement(initialAnnouncement), false)}>
                <Input label="Title" value={announcement.title} onChange={(value) => setAnnouncement((current) => ({ ...current, title: value }))} required />
                <Textarea label="Message" value={announcement.message} onChange={(value) => setAnnouncement((current) => ({ ...current, message: value }))} required />
                <button className="primary-button" type="submit">Broadcast to students</button>
              </form>
            </Panel> : null}
            <Panel title="Previous Announcements">
              <div className="announcement-list">
                {announcements.length ? announcements.map((item) => (
                  <article key={item.announcement_id}>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                  </article>
                )) : <p className="muted">No announcements created yet.</p>}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === "attendance" ? <Attendance /> : null}
        {activeTab === "staff" ? <Staff /> : null}
        {activeTab === "inventory" ? <Inventory /> : null}
        {activeTab === "reports" ? <Reports /> : null}
        {activeTab === "menu-admin" ? <MessMenu /> : null}
        {activeTab === "team" ? <Administration mode="team" /> : null}
        {activeTab === "branches" ? <Administration mode="branches" /> : null}
        {activeTab === "admissions" ? <Admissions /> : null}
        {activeTab === "visitors" ? <Visitors /> : null}
        {activeTab === "maintenance" ? <Maintenance /> : null}
        {activeTab === "meals" ? <Meals /> : null}
        {activeTab === "expenses" ? <Expenses /> : null}
      </section>

      <Modal title="Send Announcement" open={modal === "announcement"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => createAnnouncement(announcement), () => setAnnouncement(initialAnnouncement))}>
          <Input label="Title" value={announcement.title} onChange={(value) => setAnnouncement((current) => ({ ...current, title: value }))} required />
          <Textarea label="Message" value={announcement.message} onChange={(value) => setAnnouncement((current) => ({ ...current, message: value }))} required />
          <button className="primary-button" type="submit">Send to all students</button>
        </form>
      </Modal>

      <Modal title="Add Student" open={modal === "student"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => createStudent(studentForm), () => setStudentForm(initialStudent))}>
          {["name", "email", "phone", "dob", "address", "password"].map((field) => (
            <Input key={field} type={field === "password" ? "password" : field === "dob" ? "date" : "text"} label={field.replace("_", " ")} value={studentForm[field]} onChange={(value) => setStudentForm((current) => ({ ...current, [field]: value }))} required={field !== "address"} />
          ))}
          <Select label="Gender" value={studentForm.gender} onChange={(value) => setStudentForm((current) => ({ ...current, gender: value }))} options={["Male", "Female", "Other"]} />
          <button className="primary-button" type="submit">Save student</button>
        </form>
      </Modal>

      <Modal title="Add Room" open={modal === "room"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => createRoom({ ...roomForm, capacity: Number(roomForm.capacity) }), () => setRoomForm(initialRoom))}>
          <Input label="Room number" value={roomForm.room_number} onChange={(value) => setRoomForm((current) => ({ ...current, room_number: value }))} required />
          <Input label="Capacity" type="number" value={roomForm.capacity} onChange={(value) => setRoomForm((current) => ({ ...current, capacity: value }))} required />
          <button className="primary-button" type="submit">Save room</button>
        </form>
      </Modal>

      <Modal title="Allocate Room" open={modal === "allocation"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => allocateRoom({ student_id: Number(allocationForm.student_id), room_id: Number(allocationForm.room_id) }), () => setAllocationForm(initialAllocation))}>
          <Select label="Student" value={allocationForm.student_id} onChange={(value) => setAllocationForm((current) => ({ ...current, student_id: value }))} options={students.map((item) => ({ label: `${item.name} (#${item.student_id})`, value: item.student_id }))} />
          <Select label="Room" value={allocationForm.room_id} onChange={(value) => setAllocationForm((current) => ({ ...current, room_id: value }))} options={rooms.map((item) => ({ label: `${item.room_number} (${item.current_occupancy}/${item.capacity})`, value: item.room_id }))} />
          <button className="primary-button" type="submit">Allocate</button>
        </form>
      </Modal>

      <Modal title={`Transfer ${transferResident?.name || "resident"}`} open={modal === "transfer"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => transferStudent({ student_id: transferResident.student_id, room_id: Number(transferRoomId) }), () => { setTransferResident(null); setTransferRoomId(""); })}>
          <p className="muted">Current room: {transferResident?.room_number || "Unassigned"}. Transfer keeps the previous allocation in history.</p>
          <Select label="Destination room" value={transferRoomId} onChange={setTransferRoomId} options={rooms.filter((room) => Number(room.current_occupancy) < Number(room.capacity)).map((room) => ({ label: `${room.room_number} (${room.current_occupancy}/${room.capacity})`, value: room.room_id }))} />
          <button className="primary-button" type="submit" disabled={!transferRoomId}>Transfer resident</button>
        </form>
      </Modal>

      <Modal title={`${historyResident?.name || "Resident"} · Bed history`} open={modal === "history"} onClose={() => setModal("")}>
        <DataTable rows={allocationHistory} emptyText="No bed allocation history." columns={[
          { key: "room_number", label: "Room" }, { key: "bed_number", label: "Bed" },
          { key: "allocation_date", label: "Allocated", render: (row) => new Date(row.allocation_date).toLocaleDateString() },
          { key: "checked_out_at", label: "Released", render: (row) => row.checked_out_at ? new Date(row.checked_out_at).toLocaleString() : "Current" },
          { key: "checkout_note", label: "Note" }
        ]} />
      </Modal>

      <Modal title="Add Payment" open={modal === "payment"} onClose={() => setModal("")}>
        <form className="modal-form" onSubmit={(event) => handleSubmit(event, () => createPayment({ ...paymentForm, student_id: Number(paymentForm.student_id), amount: Number(paymentForm.amount) }), () => setPaymentForm(initialPayment))}>
          <Select label="Student" value={paymentForm.student_id} onChange={(value) => setPaymentForm((current) => ({ ...current, student_id: value }))} options={students.map((item) => ({ label: `${item.name} (#${item.student_id})`, value: item.student_id }))} />
          <Select label="Purpose" value={paymentForm.purpose} onChange={(value) => setPaymentForm((current) => ({ ...current, purpose: value }))} options={["mess", "hostel_fee", "laundry", "maintenance", "other"]} />
          <Input label="Amount" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm((current) => ({ ...current, amount: value }))} required />
          <Select label="Status" value={paymentForm.status} onChange={(value) => setPaymentForm((current) => ({ ...current, status: value }))} options={["pending", "paid"]} />
          <button className="primary-button" type="submit">Save payment</button>
        </form>
      </Modal>
    </Layout>
  );
}

function Panel({ title, action, children }) {
  return (
    <article className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </article>
  );
}

function Status({ value }) {
  return <span className={`status-pill ${value || "pending"}`}>{value || "pending"}</span>;
}

function ComplaintUpdates({row}) {
  return row.updates?.length ? <details><summary>{row.updates.length} update{row.updates.length===1?"":"s"}</summary><div className="announcement-list">{row.updates.map((item,index)=><article key={`${row.complaint_id}-${index}`}><span>{new Date(item.created_at).toLocaleString()} · {item.actor||"Hostel team"}</span><strong>{item.old_status||"submitted"} → {item.new_status}</strong>{item.note?<p>{item.note}</p>:null}</article>)}</div></details> : <span className="muted">No updates</span>;
}

function Input({ label, type = "text", value, onChange, required }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function Textarea({ label, value, onChange, required }) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} rows={4} />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select</option>
        {options.map((option) => {
          const normalized = typeof option === "string" ? { label: option, value: option } : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function formatPurpose(value) {
  return (value || "general").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

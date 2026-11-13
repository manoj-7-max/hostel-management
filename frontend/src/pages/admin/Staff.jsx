import { BriefcaseBusiness, Plus, UserRoundCheck, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { createStaff, getStaff, getStaffAttendance, saveStaffAttendance, setStaffActive } from "../../services/api.js";

const emptyStaff = { name: "", job_title: "", email: "", phone: "", shift: "Day" };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyStaff);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [attendanceMessage, setAttendanceMessage] = useState("");

  const load = async () => {
    try { setStaff(await getStaff()); }
    catch (err) { setError(err.response?.data?.error || "Unable to load staff."); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    getStaffAttendance(attendanceDate).then(setAttendance).catch((err) => setError(err.response?.data?.error || "Unable to load staff attendance."));
  }, [attendanceDate]);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await createStaff(form);
      setForm(emptyStaff); setOpen(false); await load();
    } catch (err) { setError(err.response?.data?.error || "Unable to add staff member."); }
    finally { setBusy(false); }
  };

  const toggleActive = async (row) => {
    setError("");
    try { await setStaffActive(row.staff_id, !row.is_active); await load(); }
    catch (err) { setError(err.response?.data?.error || "Unable to update staff member."); }
  };

  const saveAttendance = async () => {
    setError(""); setAttendanceMessage("");
    try {
      const records = attendance.filter((row) => row.status).map((row) => ({ staff_id: row.staff_id, status: row.status, note: row.note || "" }));
      await saveStaffAttendance({ date: attendanceDate, records });
      setAttendanceMessage(`Attendance saved for ${records.length} team members.`);
      setAttendance(await getStaffAttendance(attendanceDate));
    } catch (err) { setError(err.response?.data?.error || "Unable to save staff attendance."); }
  };

  return (
    <section className="page-section fade-in">
      <div className="section-toolbar">
        <div><span className="eyebrow">People & shifts</span><h2>Staff</h2></div>
        <button className="primary-button compact-button" type="button" onClick={() => setOpen(true)}><Plus size={16} />Add staff</button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="stats-grid staff-stats">
        <article className="stat-card"><div><span>Team members</span><strong>{staff.length}</strong></div><BriefcaseBusiness size={21} /></article>
        <article className="stat-card green"><div><span>Active on roster</span><strong>{staff.filter((person) => person.is_active).length}</strong></div><UserRoundCheck size={21} /></article>
      </div>
      <article className="panel">
        <div className="panel-head"><h3>Hostel team</h3><span className="muted">Manage contacts and shift assignments</span></div>
        <DataTable rows={staff} emptyText="No staff added yet." columns={[
          { key: "name", label: "Name" },
          { key: "job_title", label: "Role" },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "shift", label: "Shift" },
          { key: "is_active", label: "Status", render: (row) => <span className={`status-pill ${row.is_active ? "approved" : "rejected"}`}>{row.is_active ? "Active" : "Inactive"}</span> },
          { key: "actions", label: "Actions", render: (row) => <button className="text-button" type="button" onClick={() => toggleActive(row)}>{row.is_active ? "Deactivate" : "Reactivate"}</button> }
        ]} />
      </article>
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">DAILY ROSTER</span><h3>Staff attendance</h3></div><ClipboardCheck size={19} /></div>
        <div className="section-toolbar"><label>Attendance date<input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label><button className="primary-button compact-button" type="button" onClick={saveAttendance}>Save attendance</button></div>
        {attendanceMessage ? <p className="form-success">{attendanceMessage}</p> : null}
        <DataTable rows={attendance} emptyText="No team members are available." columns={[
          { key: "name", label: "Staff member" }, { key: "job_title", label: "Role" }, { key: "shift", label: "Shift" },
          { key: "status", label: "Attendance", render: (row) => <select aria-label={`Attendance for ${row.name}`} value={row.status || ""} onChange={(event) => setAttendance((current) => current.map((item) => item.staff_id === row.staff_id ? { ...item, status: event.target.value } : item))}><option value="">Not marked</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="leave">Leave</option></select> }
        ]} />
      </article>
      <Modal title="Add staff member" open={open} onClose={() => setOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Job title<input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} placeholder="Warden, kitchen, maintenance..." required /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Shift<select value={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.value })}><option>Day</option><option>Evening</option><option>Night</option><option>Rotating</option></select></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Add staff member"}</button>
        </form>
      </Modal>
    </section>
  );
}

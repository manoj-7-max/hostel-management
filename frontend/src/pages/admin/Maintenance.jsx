import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { createMaintenance, getMaintenance, getRooms, getStaff, updateMaintenance } from "../../services/api.js";

const emptyRequest = { room_id: "", title: "", description: "", priority: "normal" };

export default function Maintenance() {
  const [requests, setRequests] = useState([]); const [rooms, setRooms] = useState([]); const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyRequest); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const load = async () => { try { const [r, roomsData, staffData] = await Promise.all([getMaintenance(), getRooms(), getStaff()]); setRequests(r); setRooms(roomsData); setStaff(staffData.filter((item) => item.is_active)); } catch (err) { setError(err.response?.data?.error || "Unable to load maintenance requests."); } };
  useEffect(() => { load(); }, []);
  const submit = async (event) => { event.preventDefault(); setError(""); setMessage(""); try { await createMaintenance({ ...form, room_id: form.room_id ? Number(form.room_id) : null }); setForm(emptyRequest); setMessage("Maintenance request created."); await load(); } catch (err) { setError(err.response?.data?.error || "Unable to create request."); } };
  const update = async (id, payload) => { try { await updateMaintenance(id, payload); await load(); } catch (err) { setError(err.response?.data?.error || "Unable to update request."); } };
  return <section className="page-section fade-in">
    <div className="section-toolbar"><div><span className="eyebrow">FACILITIES</span><h2>Maintenance</h2></div><span className="muted">{requests.filter((item) => !["completed", "cancelled"].includes(item.status)).length} open requests</span></div>
    {error ? <p className="form-error">{error}</p> : null}{message ? <p className="form-success">{message}</p> : null}
    <div className="grid-two"><article className="panel"><div className="panel-head"><h3>Log a repair</h3><Wrench size={20} /></div><form className="stack-form" onSubmit={submit}>
      <label>Room<select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}><option value="">Common area</option>{rooms.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_number}</option>)}</select></label>
      <Field label="Issue" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
      <label>Description<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
      <label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((x) => <option key={x}>{x}</option>)}</select></label>
      <button className="primary-button">Create request</button>
    </form></article><article className="panel"><div className="panel-head"><h3>Open work orders</h3></div><DataTable rows={requests} emptyText="No maintenance requests." columns={[
      { key: "title", label: "Issue" }, { key: "room_number", label: "Room" }, { key: "resident_name", label: "Reported by" },
      { key: "priority", label: "Priority" }, { key: "status", label: "Status" },
      { key: "assigned_staff_id", label: "Assigned" , render: (row) => <select aria-label={`Assign ${row.title}`} value={row.assigned_staff_id || ""} onChange={(e) => update(row.maintenance_id, { assigned_staff_id: e.target.value ? Number(e.target.value) : null, status: e.target.value ? "assigned" : row.status })}><option value="">Unassigned</option>{staff.map((item) => <option key={item.staff_id} value={item.staff_id}>{item.name}</option>)}</select> },
      { key: "update", label: "Update", render: (row) => <select aria-label={`Status for ${row.title}`} value={row.status} onChange={(e) => update(row.maintenance_id, { status: e.target.value })}>{["open", "assigned", "in_progress", "completed", "cancelled"].map((x) => <option key={x}>{x}</option>)}</select> }
    ]} /></article></div>
  </section>;
}
function Field({ label, value, onChange, required=false }) { return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }

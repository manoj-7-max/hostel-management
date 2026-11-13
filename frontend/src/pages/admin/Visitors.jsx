import { useEffect, useState } from "react";
import { DoorOpen, UserRoundCheck } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { checkInVisitor, checkOutVisitor, getStudents, getVisitors } from "../../services/api.js";

const emptyVisit = { student_id: "", visitor_name: "", visitor_phone: "", relationship: "", purpose: "", vehicle_number: "" };

export default function Visitors() {
  const [visits, setVisits] = useState([]); const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyVisit); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = async () => { try { const [v, s] = await Promise.all([getVisitors(), getStudents()]); setVisits(v); setStudents(s.filter((item) => item.is_active)); } catch (err) { setError(err.response?.data?.error || "Unable to load visitor log."); } };
  useEffect(() => { load(); }, []);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); try { await checkInVisitor({ ...form, student_id: Number(form.student_id) }); setForm(emptyVisit); await load(); } catch (err) { setError(err.response?.data?.error || "Unable to register visitor."); } finally { setSaving(false); } };
  return <section className="page-section fade-in">
    <div className="section-toolbar"><div><span className="eyebrow">FRONT DESK</span><h2>Visitor register</h2></div><span className="muted">{visits.filter((item) => !item.checked_out_at).length} currently inside</span></div>
    {error ? <p className="form-error">{error}</p> : null}
    <div className="grid-two"><article className="panel"><div className="panel-head"><h3>Register arrival</h3><UserRoundCheck size={20} /></div>
      <form className="stack-form" onSubmit={submit}>
        <label>Resident<select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}><option value="">Choose resident</option>{students.map((item) => <option key={item.student_id} value={item.student_id}>{item.name} · Room {item.room_number || "—"}</option>)}</select></label>
        <Field label="Visitor name" value={form.visitor_name} onChange={(v) => setForm({ ...form, visitor_name: v })} required />
        <Field label="Phone" value={form.visitor_phone} onChange={(v) => setForm({ ...form, visitor_phone: v })} />
        <Field label="Relationship" value={form.relationship} onChange={(v) => setForm({ ...form, relationship: v })} />
        <Field label="Purpose" value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} required />
        <Field label="Vehicle number" value={form.vehicle_number} onChange={(v) => setForm({ ...form, vehicle_number: v })} />
        <button className="primary-button" disabled={saving}><DoorOpen size={16} /> Check in visitor</button>
      </form>
    </article><article className="panel visitor-log"><div className="panel-head"><h3>Recent visits</h3></div>
      <DataTable rows={visits} emptyText="No visitor log entries." columns={[
        { key: "visitor_name", label: "Visitor" }, { key: "resident_name", label: "Resident" }, { key: "room_number", label: "Room" },
        { key: "purpose", label: "Purpose" }, { key: "checked_in_at", label: "Arrived", render: (row) => new Date(row.checked_in_at).toLocaleString() },
        { key: "status", label: "Status", render: (row) => row.checked_out_at ? "Checked out" : <button className="text-button" type="button" onClick={async () => { await checkOutVisitor(row.visit_id); await load(); }}>Check out</button> }
      ]} />
    </article></div>
  </section>;
}
function Field({ label, value, onChange, required=false }) { return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }

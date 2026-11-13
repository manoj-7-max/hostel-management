import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { createAdmission, downloadAdmissionDocument, getAdmissions, reviewAdmission, setAdmissionDocumentStatus, uploadAdmissionDocument } from "../../services/api.js";

const emptyApplication = { applicant_name: "", email: "", phone: "", gender: "Female", dob: "", requested_move_in: "", address: "", guardian: { full_name: "", relation: "Parent", phone: "", email: "" } };
const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function Admissions() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyApplication);
  const [files, setFiles] = useState([]);
  const [initialPasswords, setInitialPasswords] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage = user?.permissions?.includes("students.manage");

  const load = async () => { try { setApplications(await getAdmissions()); } catch (err) { setError(err.response?.data?.error || "Unable to load admissions."); } };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const application = await createAdmission(form);
      for (const file of files) {
        await uploadAdmissionDocument(application.application_id, {
          file_name: file.name,
          content_type: file.type,
          file_base64: await readFile(file)
        });
      }
      setForm(emptyApplication); setFiles([]); setMessage(`Application ${application.application_number} created.`); await load();
    } catch (err) { setError(err.response?.data?.error || err.message || "Unable to save admission."); }
    finally { setSaving(false); }
  };

  const updateStatus = async (row, status) => {
    setError(""); setMessage("");
    try {
      const password = initialPasswords[row.application_id];
      const response = await reviewAdmission(row.application_id, { status, password });
      setMessage(status === "approved" ? `Resident account created for ${response.applicant_name}. Their password must be reset at sign-in.` : `Application moved to ${status.replaceAll("_", " ")}.`);
      setInitialPasswords((current) => ({ ...current, [row.application_id]: "" }));
      await load();
    } catch (err) { setError(err.response?.data?.error || "Unable to update application."); }
  };

  const updateDocumentStatus=async(doc,status)=>{
    setError("");setMessage("");
    try{await setAdmissionDocumentStatus(doc.document_id,{status});setMessage(`Document marked ${status}.`);await load();}
    catch(err){setError(err.response?.data?.error||"Unable to update document verification.");}
  };

  return <section className="page-section fade-in">
    <div className="section-toolbar"><div><span className="eyebrow">RESIDENT INTAKE</span><h2>Admissions</h2></div><span className="muted">{applications.length} applications</span></div>
    {error ? <p className="form-error">{error}</p> : null}{message ? <p className="form-success">{message}</p> : null}
    {canManage ? <article className="panel admissions-form-panel"><div className="panel-head"><div><span className="eyebrow">NEW APPLICATION</span><h3>Applicant details</h3></div><FileText size={20} /></div>
      <form className="admission-form" onSubmit={submit}>
        <Field label="Full name" value={form.applicant_name} onChange={(v) => setForm({ ...form, applicant_name: v })} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
        <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} required />
        <label>Gender<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></label>
        <Field label="Requested move-in" type="date" value={form.requested_move_in} onChange={(v) => setForm({ ...form, requested_move_in: v })} />
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Field label="Guardian name" value={form.guardian.full_name} onChange={(v) => setForm({ ...form, guardian: { ...form.guardian, full_name: v } })} />
        <Field label="Guardian relation" value={form.guardian.relation} onChange={(v) => setForm({ ...form, guardian: { ...form.guardian, relation: v } })} />
        <Field label="Guardian phone" value={form.guardian.phone} onChange={(v) => setForm({ ...form, guardian: { ...form.guardian, phone: v } })} />
        <Field label="Guardian email (for parent portal access)" type="email" value={form.guardian.email} onChange={(v) => setForm({ ...form, guardian: { ...form.guardian, email: v } })} />
        <label className="file-field">Private documents (PDF, JPG, PNG · up to 5 MB each)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
        <button className="primary-button" disabled={saving}><Plus size={16} />{saving ? "Saving..." : "Create application"}</button>
      </form>
    </article> : null}
    <article className="panel"><div className="panel-head"><h3>Applications</h3></div>
      <DataTable rows={applications} emptyText="No applications for this hostel yet." columns={[
        { key: "application_number", label: "Application" }, { key: "applicant_name", label: "Applicant" },
        { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
        { key: "guardian_name", label: "Guardian", render: (row) => row.guardian_name ? `${row.guardian_name} · ${row.guardian_phone}` : "—" },
        { key: "documents", label: "Documents", render: (row) => row.documents?.length ? <div className="admin-list">{row.documents.map((doc) => <div className="admin-list-row" key={doc.document_id}><div className="admin-list-copy"><button className="text-button" type="button" onClick={() => downloadAdmissionDocument(doc.document_id, doc.file_name)}>{doc.file_name}</button><small>Verification: {doc.verification_status}</small></div>{canManage&&doc.verification_status!=="verified"?<button className="text-button" type="button" onClick={()=>updateDocumentStatus(doc,"verified")}>Verify</button>:null}{canManage&&doc.verification_status!=="rejected"?<button className="text-button danger" type="button" onClick={()=>updateDocumentStatus(doc,"rejected")}>Reject</button>:null}</div>)}</div> : "—" },
        { key: "status", label: "Status", render: (row) => <span className={`status-pill ${row.status}`}>{row.status.replaceAll("_", " ")}</span> },
        ...(canManage ? [{ key: "actions", label: "Review", render: (row) => row.status === "approved" ? <span className="muted">Resident #{row.student_id}</span> : <div className="review-actions">
          <input type="password" aria-label={`Initial password for ${row.applicant_name}`} placeholder="Initial password" value={initialPasswords[row.application_id] || ""} onChange={(event) => setInitialPasswords((current) => ({ ...current, [row.application_id]: event.target.value }))} />
          <button className="text-button" type="button" onClick={() => updateStatus(row, "under_review")}>Review</button>
          <button className="text-button" type="button" onClick={() => updateStatus(row, "approved")}>Approve</button>
          <button className="text-button danger" type="button" onClick={() => updateStatus(row, "rejected")}>Reject</button>
        </div> }] : [])
      ]} />
    </article>
  </section>;
}

function Field({ label, type="text", value, onChange, required=false }) { return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>; }

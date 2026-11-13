import { CalendarCheck2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable.jsx";
import { getAttendance, saveAttendance } from "../../services/api.js";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function Attendance() {
  const [date, setDate] = useState(localDate);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async (selectedDate = date) => {
    setLoading(true);
    setError("");
    try {
      setRecords(await getAttendance(selectedDate));
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  const setStatus = (studentId, status) => {
    setRecords((current) => current.map((row) => row.student_id === studentId ? { ...row, status } : row));
    setMessage("");
  };

  const save = async () => {
    setError("");
    setMessage("");
    if (records.some((row) => !row.status)) {
      setError("Choose a status for each student before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveAttendance({ date, records: records.map(({ student_id, status, note }) => ({ student_id, status, note })) });
      setMessage(result.message);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = records.filter((row) => row.status === "present").length;

  return (
    <section className="page-section fade-in">
      <div className="section-toolbar">
        <div><span className="eyebrow">Daily roll call</span><h2>Attendance</h2></div>
        <div className="button-row attendance-actions">
          <label className="date-filter"><CalendarCheck2 size={17} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Attendance date" /></label>
          <button className="primary-button compact-button" type="button" onClick={save} disabled={saving || loading || records.length === 0}><Save size={16} />{saving ? "Saving..." : "Save attendance"}</button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <article className="panel">
        <div className="panel-head"><h3>Resident attendance</h3><span className="muted">{presentCount} of {records.length} marked present</span></div>
        {loading ? <p className="muted">Loading attendance...</p> : (
          <DataTable
            rows={records}
            emptyText="No active students found. Add residents first."
            columns={[
              { key: "student_id", label: "ID" },
              { key: "name", label: "Resident" },
              { key: "room_number", label: "Room" },
              { key: "status", label: "Status", render: (row) => (
                <select className="attendance-select" aria-label={`Attendance for ${row.name}`} value={row.status || ""} onChange={(event) => setStatus(row.student_id, event.target.value)}>
                  <option value="">Choose status</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="leave">On leave</option>
                </select>
              ) }
            ]}
          />
        )}
      </article>
    </section>
  );
}

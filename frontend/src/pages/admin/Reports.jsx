import { Download, FileChartColumnIncreasing, Users } from "lucide-react";
import { useEffect, useState } from "react";
import StatCard from "../../components/StatCard.jsx";
import { getReportSummary } from "../../services/api.js";

function downloadCsv(summary) {
  const rows = [
    ["Hostel operations summary", new Date().toLocaleDateString()],
    ["Active residents", summary.active_students],
    ["Rooms", summary.room_count],
    ["Beds occupied", summary.occupied_beds],
    ["Total beds", summary.total_beds],
    ["Open complaints", summary.open_complaints],
    ["Paid charges", summary.paid_total],
    ["Pending charges", summary.pending_total],
    ["Hostel expenses", summary.expense_total],
    ["Net after expenses", Number(summary.paid_total) - Number(summary.expense_total)],
    ["Currently outside", summary.outside_now],
    ["Present today", summary.present_today],
    ["Absent today", summary.absent_today]
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "hostel-operations-summary.csv"; link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getReportSummary().then(setSummary).catch((err) => setError(err.response?.data?.error || "Unable to load reports."));
  }, []);

  if (error) return <section className="page-section"><p className="form-error">{error}</p></section>;
  if (!summary) return <section className="page-section"><p className="muted">Preparing reports...</p></section>;

  const utilization = summary.total_beds ? Math.round((summary.occupied_beds / summary.total_beds) * 100) : 0;
  return (
    <section className="page-section fade-in">
      <div className="section-toolbar">
        <div><span className="eyebrow">A clear view of hostel operations</span><h2>Reports</h2></div>
        <button className="secondary-button" type="button" onClick={() => downloadCsv(summary)}><Download size={16} />Export CSV</button>
      </div>
      <div className="stats-grid">
        <StatCard label="Active residents" value={summary.active_students} icon={Users} />
        <StatCard label="Open complaints" value={summary.open_complaints} icon={FileChartColumnIncreasing} tone="amber" />
        <StatCard label="Currently outside" value={summary.outside_now} icon={Users} tone="rose" />
        <StatCard label="Rooms in service" value={summary.room_count} icon={FileChartColumnIncreasing} tone="green" />
      </div>
      <div className="grid-two">
        <article className="panel report-panel">
          <div className="panel-head"><h3>Room utilization</h3><span className="status-pill">{utilization}% occupied</span></div>
          <div className="report-progress"><span style={{ width: `${Math.min(utilization, 100)}%` }} /></div>
          <div className="report-split"><span>Occupied beds <strong>{summary.occupied_beds}</strong></span><span>Available beds <strong>{Math.max(0, summary.total_beds - summary.occupied_beds)}</strong></span></div>
        </article>
        <article className="panel report-panel">
          <div className="panel-head"><h3>Fee collection</h3><span className="muted">Current records</span></div>
          <div className="report-split"><span>Collected <strong>₹{Number(summary.paid_total).toLocaleString("en-IN")}</strong></span><span>Pending <strong>₹{Number(summary.pending_total).toLocaleString("en-IN")}</strong></span></div>
          <div className="report-footnote">Payments recorded in the hostel system.</div>
        </article>
        <article className="panel report-panel">
          <div className="panel-head"><h3>Monthly expenses</h3><span className="muted">This month</span></div>
          <div className="report-split"><span>Spent <strong>₹{Number(summary.expense_total).toLocaleString("en-IN")}</strong></span><span>Net collected <strong>₹{(Number(summary.paid_total)-Number(summary.expense_total)).toLocaleString("en-IN")}</strong></span></div>
          <div className="report-footnote">Expense entries recorded for this hostel in the current month.</div>
        </article>
        <article className="panel report-panel">
          <div className="panel-head"><h3>Today’s attendance</h3><span className="muted">{new Date().toLocaleDateString()}</span></div>
          <div className="report-split"><span>Present <strong>{summary.present_today}</strong></span><span>Absent <strong>{summary.absent_today}</strong></span></div>
          <div className="report-footnote">Unmarked residents are not included in these totals.</div>
        </article>
      </div>
    </section>
  );
}

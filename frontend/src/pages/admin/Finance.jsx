import { useEffect, useState } from "react";
import { CreditCard, ReceiptText, RotateCcw } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { createInvoice, createPaymentRefund, generateMonthlyInvoices, getFeeTypes, getInvoices, getPayments, getStudentsPage, setFeeRate, recordInvoicePayment } from "../../services/api.js";

function monthNow() { return new Date().toISOString().slice(0,7); }
function dueDefault() { const d=new Date(); d.setMonth(d.getMonth()+1,10); return d.toISOString().slice(0,10); }

export default function Finance() {
  const [invoices, setInvoices] = useState([]); const [payments, setPayments] = useState([]); const [feeTypes, setFeeTypes] = useState([]); const [students,setStudents]=useState([]);
  const [period, setPeriod] = useState(monthNow()); const [dueDate, setDueDate] = useState(dueDefault());
  const [amounts, setAmounts] = useState({}); const [paymentDrafts, setPaymentDrafts] = useState({}); const [refundDrafts, setRefundDrafts] = useState({});
  const [studentSearch,setStudentSearch]=useState("");
  const [oneOff,setOneOff]=useState({student_id:"",billing_period:monthNow(),due_date:dueDefault(),fee_type_id:"",amount:""});
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [saving, setSaving] = useState(false);
  const load = async () => { try { const [i,p,f]=await Promise.all([getInvoices(),getPayments(),getFeeTypes()]); setInvoices(i); setPayments(p); setFeeTypes(f); } catch (err) { setError(err.response?.data?.error || "Unable to load billing records."); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { getStudentsPage(1,100,studentSearch).then((page)=>setStudents(page.data)).catch((err)=>setError(err.response?.data?.error||"Unable to search residents.")); }, [studentSearch]);
  const run = async (action, success) => { setSaving(true); setError(""); setNotice(""); try { const result=await action(); setNotice(success(result)); await load(); } catch (err) { setError(err.response?.data?.error || err.message || "Unable to save billing update."); } finally { setSaving(false); } };
  const generate = (event) => { event.preventDefault(); run(() => generateMonthlyInvoices({ billing_period: period, due_date: dueDate }), (result) => `Created ${result.created} invoices for ${result.billing_period}; ${result.skipped} already existed.`); };
  const makeOneOff=(event)=>{event.preventDefault();const fee=feeTypes.find((item)=>String(item.fee_type_id)===String(oneOff.fee_type_id));run(()=>createInvoice({student_id:Number(oneOff.student_id),billing_period:oneOff.billing_period,due_date:oneOff.due_date,items:[{fee_type_id:Number(oneOff.fee_type_id),description:fee?.fee_name||"Additional charge",quantity:1,unit_amount:Number(oneOff.amount)}]}),()=>"One-off invoice created.");};

  return <section className="page-section fade-in">
    <div className="section-toolbar"><div><span className="eyebrow">FEES & COLLECTION</span><h2>Billing & payments</h2></div><span className="muted">{invoices.length} invoices · {payments.length} payment records</span></div>
    {error ? <p className="form-error">{error}</p> : null}{notice ? <p className="form-success">{notice}</p> : null}
    <div className="grid-two finance-tools">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">RECURRING BILLING</span><h3>Generate monthly invoices</h3></div><ReceiptText size={20} /></div>
        <form className="stack-form" onSubmit={generate}>
          <label>Billing month<input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required /></label>
          <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
          <button className="primary-button" disabled={saving}>Generate invoices for active residents</button>
        </form>
      </article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">RATE CARD</span><h3>Recurring fee rates</h3></div></div>
        <div className="fee-rate-list">{feeTypes.filter((item) => item.is_recurring).map((fee) => <div className="fee-rate-row" key={fee.fee_type_id}>
          <div><strong>{fee.fee_name}</strong><small>Current Rs. {fee.amount}</small></div>
          <input aria-label={`${fee.fee_name} amount`} type="number" min="0" step="0.01" placeholder="New amount" value={amounts[fee.fee_type_id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [fee.fee_type_id]: e.target.value })} />
          <button className="text-button" type="button" disabled={!amounts[fee.fee_type_id]} onClick={() => run(() => setFeeRate(fee.fee_type_id, amounts[fee.fee_type_id]), () => { setAmounts({ ...amounts, [fee.fee_type_id]: "" }); return `${fee.fee_name} rate updated.`; })}>Save</button>
        </div>)}{!feeTypes.length ? <p className="muted">No fee rates configured.</p> : null}</div>
      </article>
    </div>
    <article className="panel"><div className="panel-head"><div><span className="eyebrow">DEPOSITS & OTHER CHARGES</span><h3>Create a one-off invoice</h3></div><ReceiptText size={20}/></div>
      <form className="admission-form" onSubmit={makeOneOff}>
        <label>Find resident<input type="search" placeholder="Search name, ID, or email" value={studentSearch} onChange={(e)=>setStudentSearch(e.target.value)}/></label>
        <label>Resident<select required value={oneOff.student_id} onChange={(e)=>setOneOff({...oneOff,student_id:e.target.value})}><option value="">Select resident</option>{students.map((s)=><option key={s.student_id} value={s.student_id}>{s.name} · #{s.student_id}</option>)}</select></label>
        <label>Fee category<select required value={oneOff.fee_type_id} onChange={(e)=>setOneOff({...oneOff,fee_type_id:e.target.value})}><option value="">Select category</option>{feeTypes.map((fee)=><option key={fee.fee_type_id} value={fee.fee_type_id}>{fee.fee_name}</option>)}</select></label>
        <label>Billing period<input type="month" required value={oneOff.billing_period} onChange={(e)=>setOneOff({...oneOff,billing_period:e.target.value})}/></label>
        <label>Due date<input type="date" required value={oneOff.due_date} onChange={(e)=>setOneOff({...oneOff,due_date:e.target.value})}/></label>
        <label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={oneOff.amount} onChange={(e)=>setOneOff({...oneOff,amount:e.target.value})}/></label>
        <button className="primary-button" disabled={saving}>Create invoice</button>
      </form>
    </article>
    <article className="panel"><div className="panel-head"><div><span className="eyebrow">RESIDENT BALANCES</span><h3>Invoices</h3></div></div>
      <DataTable rows={invoices} emptyText="No invoices have been generated for this hostel." columns={[
        { key: "invoice_number", label: "Invoice" }, { key: "student_name", label: "Resident" }, { key: "billing_period", label: "Period" },
        { key: "due_date", label: "Due" }, { key: "items", label: "Lines", render: (row) => row.items?.map((item) => `${item.description}: Rs. ${item.line_total}`).join(" · ") || "—" },
        { key: "total_amount", label: "Total", render: (row) => `Rs. ${Number(row.total_amount).toFixed(2)}` },
        { key: "paid_amount", label: "Paid", render: (row) => `Rs. ${Number(row.paid_amount).toFixed(2)}` },
        { key: "balance_due", label: "Balance", render: (row) => <strong>Rs. {Number(row.balance_due).toFixed(2)}</strong> },
        { key: "status", label: "Status", render: (row) => <span className={`status-pill ${row.status}`}>{row.status}</span> },
        { key: "record", label: "Record payment", render: (row) => row.balance_due > 0 ? <div className="inline-finance-form"><input aria-label={`Amount for ${row.invoice_number}`} type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentDrafts[row.invoice_id]?.amount || ""} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [row.invoice_id]: { ...paymentDrafts[row.invoice_id], amount: e.target.value } })} /><select aria-label="Payment method" value={paymentDrafts[row.invoice_id]?.payment_method || "cash"} onChange={(e) => setPaymentDrafts({ ...paymentDrafts, [row.invoice_id]: { ...paymentDrafts[row.invoice_id], payment_method: e.target.value } })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank transfer">Bank transfer</option><option value="cheque">Cheque</option></select><button className="text-button" type="button" onClick={() => run(() => recordInvoicePayment(row.invoice_id, paymentDrafts[row.invoice_id]), () => { setPaymentDrafts({ ...paymentDrafts, [row.invoice_id]: { amount: "", payment_method: "cash" } }); return "Payment recorded."; })}>Record</button></div> : "—" }
      ]} />
    </article>
    <article className="panel"><div className="panel-head"><div><span className="eyebrow">RECEIPT HISTORY</span><h3>Payments & refunds</h3></div><CreditCard size={20} /></div>
      <DataTable rows={payments} emptyText="No payment records yet." columns={[
        { key: "payment_id", label: "ID" }, { key: "student_name", label: "Resident", render: (row) => row.student_name || `#${row.student_id}` },
        { key: "invoice_number", label: "Invoice", render: (row) => row.invoice_number || (row.invoice_id ? `#${row.invoice_id}` : "Legacy payment") }, { key: "amount", label: "Amount", render: (row) => `Rs. ${row.amount}` },
        { key: "payment_method", label: "Method", render: (row) => row.payment_method || "—" }, { key: "transaction_reference", label: "Reference", render: (row) => row.transaction_reference || "—" },
        { key: "status", label: "Status" }, { key: "receipt", label: "Receipt", render: (row) => row.status === "paid" ? <button className="text-button" type="button" onClick={() => printReceipt(row)}>Print / PDF</button> : "—" },
        { key: "refund", label: "Refund", render: (row) => row.status === "paid" ? <div className="inline-finance-form"><input type="number" min="0.01" step="0.01" placeholder="Amount" aria-label={`Refund amount for payment ${row.payment_id}`} value={refundDrafts[row.payment_id]?.amount || ""} onChange={(e) => setRefundDrafts({ ...refundDrafts, [row.payment_id]: { ...refundDrafts[row.payment_id], amount: e.target.value } })} /><input placeholder="Reason" aria-label={`Refund reason for payment ${row.payment_id}`} value={refundDrafts[row.payment_id]?.reason || ""} onChange={(e) => setRefundDrafts({ ...refundDrafts, [row.payment_id]: { ...refundDrafts[row.payment_id], reason: e.target.value } })} /><button className="text-button danger" type="button" onClick={() => run(() => createPaymentRefund(row.payment_id, refundDrafts[row.payment_id]), () => "Refund recorded.")}><RotateCcw size={14} /> Refund</button></div> : "—" }
      ]} />
    </article>
  </section>;
}

function printReceipt(row) {
  const escape=(value)=>String(value??"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const popup=window.open("","_blank","width=720,height=820");
  if(!popup)return;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payment receipt</title><style>body{font:15px Arial,sans-serif;color:#1d2c28;margin:48px}.receipt{max-width:620px;margin:auto;border:1px solid #cad8d1;border-radius:18px;padding:34px}.brand{color:#28735e;font-size:12px;font-weight:bold;letter-spacing:2px}.title{margin:10px 0 24px;font-size:28px}.amount{font-size:34px;font-weight:bold;margin:20px 0}.row{display:flex;justify-content:space-between;border-top:1px solid #e1e9e5;padding:12px 0}.foot{margin-top:24px;color:#65756e;font-size:12px}@media print{body{margin:0}.receipt{border:0}}</style></head><body><main class="receipt"><div class="brand">HOSTEL MANAGEMENT</div><h1 class="title">Payment receipt</h1><div class="row"><span>Receipt reference</span><strong>${escape(row.transaction_reference||`PAY-${row.payment_id}`)}</strong></div><div class="amount">₹${Number(row.amount).toLocaleString("en-IN",{minimumFractionDigits:2})}</div><div class="row"><span>Resident</span><strong>${escape(row.student_name||`Resident #${row.student_id}`)}</strong></div><div class="row"><span>Payment date</span><strong>${escape(row.payment_date?new Date(row.payment_date).toLocaleDateString():"—")}</strong></div><div class="row"><span>Payment method</span><strong>${escape(row.payment_method||"Recorded payment")}</strong></div><div class="row"><span>Invoice</span><strong>${escape(row.invoice_number||(row.invoice_id?`#${row.invoice_id}`:"Legacy payment"))}</strong></div><div class="row"><span>Status</span><strong>${escape(row.status)}</strong></div><p class="foot">Generated from the hostel management system. This receipt records a payment saved by an authorized administrator.</p></main><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  popup.document.close();
}

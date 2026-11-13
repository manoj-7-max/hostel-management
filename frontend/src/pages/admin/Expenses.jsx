import { useEffect, useState } from "react";
import { ReceiptIndianRupee } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { createExpense, getExpenses } from "../../services/api.js";

const blank=()=>({expense_date:new Date().toLocaleDateString("en-CA"),category:"Mess",description:"",amount:"",vendor:"",reference_number:""});
export default function Expenses(){
 const {user}=useAuth();const canWrite=user?.permissions?.includes("mess.manage")||user?.permissions?.includes("fees.manage");
 const [rows,setRows]=useState([]);const [form,setForm]=useState(blank());const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=()=>getExpenses().then(setRows).catch(e=>setError(e.response?.data?.error||"Unable to load expenses."));useEffect(()=>{load();},[]);
 const submit=async(e)=>{e.preventDefault();setError("");setNotice("");try{await createExpense({...form,amount:Number(form.amount)});setForm(blank());setNotice("Expense recorded.");await load();}catch(err){setError(err.response?.data?.error||"Unable to record this expense.");}};
 return <section className="page-section fade-in"><div className="section-toolbar"><div><span className="eyebrow">COST CONTROL</span><h2>Hostel expenses</h2></div></div>{error?<p className="form-error">{error}</p>:null}{notice?<p className="form-success">{notice}</p>:null}
 <div className="grid-two">{canWrite?<article className="panel"><div className="panel-head"><h3>Record expense</h3><ReceiptIndianRupee size={19}/></div><form className="stack-form" onSubmit={submit}>
 <label>Date<input type="date" required value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})}/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{["Mess","Utilities","Maintenance","Supplies","Payroll","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Description<input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Vendor<input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})}/></label><label>Reference<input value={form.reference_number} onChange={e=>setForm({...form,reference_number:e.target.value})}/></label><button className="primary-button">Save expense</button></form></article>:null}
 <article className="panel"><div className="panel-head"><h3>Recorded costs</h3><span className="status-pill">₹{rows.reduce((n,r)=>n+Number(r.amount),0).toLocaleString("en-IN")}</span></div><DataTable rows={rows} emptyText="No expenses recorded." columns={[{key:"expense_date",label:"Date"},{key:"category",label:"Category"},{key:"description",label:"Description"},{key:"amount",label:"Amount",render:r=>`₹${Number(r.amount).toLocaleString("en-IN")}`},{key:"vendor",label:"Vendor"}]} /></article></div>
 </section>;
}

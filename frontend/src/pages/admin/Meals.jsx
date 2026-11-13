import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Utensils } from "lucide-react";
import DataTable from "../../components/DataTable.jsx";
import { createMealSubscription, getMealAttendance, getMealSubscriptions, getStudentsPage, markMealAttendance, updateMealSubscription } from "../../services/api.js";

const today = () => new Date().toLocaleDateString("en-CA");

export default function Meals() {
  const [subscriptions,setSubscriptions]=useState([]); const [attendance,setAttendance]=useState([]); const [students,setStudents]=useState([]);
  const [date,setDate]=useState(today()); const [mealType,setMealType]=useState("breakfast");
  const [form,setForm]=useState({student_id:"",plan_name:"Standard",start_date:today(),monthly_amount:""}); const [studentSearch,setStudentSearch]=useState("");
  const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const load=async()=>{const [plans,rows,page]=await Promise.all([getMealSubscriptions(),getMealAttendance(date,mealType),getStudentsPage(1,100,studentSearch)]);setSubscriptions(plans);setAttendance(rows);setStudents(page.data);};
  useEffect(()=>{load().catch((e)=>setError(e.response?.data?.error||"Unable to load meal operations."));},[date,mealType,studentSearch]);
  const currentPlans=useMemo(()=>new Set(subscriptions.filter((s)=>s.status==="active"&&s.start_date<=date&&(!s.end_date||s.end_date>=date)).map((s)=>Number(s.student_id))),[subscriptions,date]);
  const submit=async(event)=>{event.preventDefault();setError("");setNotice("");try{await createMealSubscription({...form,student_id:Number(form.student_id),monthly_amount:Number(form.monthly_amount)});setNotice("Meal plan started.");await load();}catch(e){setError(e.response?.data?.error||"Unable to start the plan.");}};
  const mark=async(row)=>{setError("");try{await markMealAttendance({student_id:row.student_id,meal_date:date,meal_type:mealType});await load();}catch(e){setError(e.response?.data?.error||"Unable to mark this meal.");}};
  const changePlan=async(row,status)=>{setError("");try{await updateMealSubscription(row.subscription_id,{status,end_date:status==="ended"?(today()>row.start_date?today():row.start_date):undefined});await load();}catch(e){setError(e.response?.data?.error||"Unable to update meal plan.");}};
  return <section className="page-section fade-in">
    <div className="section-toolbar"><div><span className="eyebrow">DINING OPERATIONS</span><h2>Meals & subscriptions</h2></div></div>
    {error?<p className="form-error">{error}</p>:null}{notice?<p className="form-success">{notice}</p>:null}
    <div className="grid-two"><article className="panel"><div className="panel-head"><h3>Start a meal plan</h3><Utensils size={18}/></div><form className="stack-form" onSubmit={submit}>
      <label>Find resident<input type="search" placeholder="Search name, ID, or email" value={studentSearch} onChange={(e)=>setStudentSearch(e.target.value)}/></label><label>Resident<select required value={form.student_id} onChange={(e)=>setForm({...form,student_id:e.target.value})}><option value="">Choose resident</option>{students.map((s)=><option key={s.student_id} value={s.student_id}>{s.name} · #{s.student_id}</option>)}</select></label>
      <label>Plan name<input required value={form.plan_name} onChange={(e)=>setForm({...form,plan_name:e.target.value})}/></label>
      <label>Start date<input type="date" required value={form.start_date} onChange={(e)=>setForm({...form,start_date:e.target.value})}/></label>
      <label>Monthly amount (₹)<input type="number" min="0" step="0.01" required value={form.monthly_amount} onChange={(e)=>setForm({...form,monthly_amount:e.target.value})}/></label>
      <button className="primary-button">Start subscription</button></form></article>
      <article className="panel"><div className="panel-head"><h3>Meal check-in</h3><ClipboardCheck size={18}/></div><div className="button-row"><label>Date<input type="date" value={date} onChange={(e)=>setDate(e.target.value)}/></label><label>Meal<select value={mealType} onChange={(e)=>setMealType(e.target.value)}>{["breakfast","lunch","snacks","dinner"].map((m)=><option key={m}>{m}</option>)}</select></label></div>
      <DataTable rows={attendance} emptyText="No active residents." columns={[{key:"name",label:"Resident"},{key:"room_number",label:"Room"},{key:"meal_attendance_id",label:"Attendance",render:(row)=>row.meal_attendance_id?<span className="status-pill approved">Served</span>:currentPlans.has(Number(row.student_id))?<button className="text-button" onClick={()=>mark(row)}>Mark served</button>:<span className="muted">No active plan</span>}]} /></article></div>
    <article className="panel"><div className="panel-head"><h3>Meal plans</h3><span className="muted">{subscriptions.length} records</span></div><DataTable rows={subscriptions} emptyText="No meal plans yet." columns={[{key:"student_name",label:"Resident"},{key:"plan_name",label:"Plan"},{key:"start_date",label:"Starts"},{key:"monthly_amount",label:"Monthly",render:(r)=>`₹${Number(r.monthly_amount).toLocaleString("en-IN")}`},{key:"status",label:"Status"},{key:"actions",label:"Actions",render:(r)=>r.status==="active"?<button className="text-button danger" onClick={()=>changePlan(r,"paused")}>Pause</button>:r.status==="paused"?<button className="text-button" onClick={()=>changePlan(r,"active")}>Resume</button>:<span className="muted">Ended</span>}]} /></article>
  </section>;
}

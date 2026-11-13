import { CalendarDays, Plus, Trash2, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable.jsx";
import { createMenuItem, deleteMenuItem, getMenu } from "../../services/api.js";

const emptyForm = { day: "Monday", meal_type: "Breakfast", description: "" };

export default function MessMenu() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try { setItems(await getMenu()); }
    catch (err) { setError(err.response?.data?.error || "Unable to load mess menu."); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await createMenuItem(form); setForm(emptyForm); setMessage("Menu item added."); await load();
    } catch (err) { setError(err.response?.data?.error || "Unable to add menu item."); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    setError("");
    try { await deleteMenuItem(id); await load(); }
    catch (err) { setError(err.response?.data?.error || "Unable to remove menu item."); }
  };

  return (
    <section className="page-section fade-in">
      <div className="section-toolbar"><div><span className="eyebrow">Dining & weekly meals</span><h2>Mess menu</h2></div></div>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <div className="grid-two">
        <article className="panel">
          <div className="panel-head"><h3>Plan a meal</h3><Utensils size={18} /></div>
          <form className="stack-form" onSubmit={submit}>
            <label>Day<select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <option key={day}>{day}</option>)}</select></label>
            <label>Meal<select value={form.meal_type} onChange={(event) => setForm({ ...form, meal_type: event.target.value })}>{["Breakfast", "Lunch", "Snacks", "Dinner"].map((meal) => <option key={meal}>{meal}</option>)}</select></label>
            <label>Menu details<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="List dishes or meal details" required /></label>
            <button className="primary-button" type="submit" disabled={busy}><Plus size={16} />{busy ? "Adding..." : "Add to menu"}</button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-head"><h3>Weekly menu</h3><CalendarDays size={18} /></div>
          <DataTable rows={items} emptyText="No meals scheduled yet." columns={[
            { key: "day", label: "Day" },
            { key: "meal_type", label: "Meal" },
            { key: "description", label: "Menu" },
            { key: "actions", label: "", render: (row) => <button className="icon-button menu-delete" aria-label={`Remove ${row.day} ${row.meal_type}`} type="button" onClick={() => remove(row.menu_id)}><Trash2 size={16} /></button> }
          ]} />
        </article>
      </div>
    </section>
  );
}

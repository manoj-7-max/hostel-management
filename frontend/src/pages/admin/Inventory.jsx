import { AlertTriangle, Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/Modal.jsx";
import { adjustInventory, createInventoryItem, getInventory } from "../../services/api.js";

const emptyItem = { item_name: "", category: "Housekeeping", quantity: "", unit: "units", reorder_level: "", location: "" };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try { setItems(await getInventory()); }
    catch (err) { setError(err.response?.data?.error || "Unable to load inventory."); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await createInventoryItem({ ...form, quantity: Number(form.quantity), reorder_level: Number(form.reorder_level || 0) });
      setForm(emptyItem); setOpen(false); await load();
    } catch (err) { setError(err.response?.data?.error || "Unable to add inventory item."); }
    finally { setBusy(false); }
  };

  const changeQuantity = async (item, delta) => {
    setError("");
    try { await adjustInventory(item.inventory_id, delta); await load(); }
    catch (err) { setError(err.response?.data?.error || "Unable to update quantity."); }
  };

  const lowStock = items.filter((item) => Number(item.quantity) <= Number(item.reorder_level)).length;

  return (
    <section className="page-section fade-in">
      <div className="section-toolbar">
        <div><span className="eyebrow">Supplies & stock</span><h2>Inventory</h2></div>
        <button className="primary-button compact-button" type="button" onClick={() => setOpen(true)}><Plus size={16} />Add item</button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="stats-grid staff-stats">
        <article className="stat-card"><div><span>Items tracked</span><strong>{items.length}</strong></div><Package size={21} /></article>
        <article className={lowStock ? "stat-card amber" : "stat-card green"}><div><span>At reorder level</span><strong>{lowStock}</strong></div><AlertTriangle size={21} /></article>
      </div>
      <article className="panel">
        <div className="panel-head"><h3>Stock register</h3><span className="muted">Use the controls to adjust quantities</span></div>
        <DataTable rows={items} emptyText="No supplies recorded yet." columns={[
          { key: "item_name", label: "Item" },
          { key: "category", label: "Category" },
          { key: "quantity", label: "In stock", render: (row) => <strong>{Number(row.quantity)} {row.unit}</strong> },
          { key: "reorder_level", label: "Reorder at", render: (row) => `${Number(row.reorder_level)} ${row.unit}` },
          { key: "location", label: "Stored at" },
          { key: "actions", label: "Adjust", render: (row) => <div className="quantity-controls"><button type="button" aria-label={`Remove one ${row.item_name}`} onClick={() => changeQuantity(row, -1)}>−</button><button type="button" aria-label={`Add one ${row.item_name}`} onClick={() => changeQuantity(row, 1)}>+</button></div> }
        ]} />
      </article>
      <Modal title="Add inventory item" open={open} onClose={() => setOpen(false)}>
        <form className="modal-form" onSubmit={submit}>
          <label>Item name<input value={form.item_name} onChange={(event) => setForm({ ...form, item_name: event.target.value })} required /></label>
          <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Housekeeping</option><option>Furniture</option><option>Electrical</option><option>Kitchen</option><option>Safety</option><option>Other</option></select></label>
          <div className="form-grid-two">
            <label>Quantity<input type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></label>
            <label>Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="units, litres..." required /></label>
          </div>
          <label>Reorder level<input type="number" min="0" step="0.01" value={form.reorder_level} onChange={(event) => setForm({ ...form, reorder_level: event.target.value })} /></label>
          <label>Storage location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Add item"}</button>
        </form>
      </Modal>
    </section>
  );
}

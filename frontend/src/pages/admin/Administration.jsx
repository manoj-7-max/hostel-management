import { useEffect, useState } from "react";
import { Building2, Plus, UserPlus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getStoredHostelId, setStoredHostelId } from "../../utils/storage.js";
import {
  createBuilding, createFloor, createHostel, createUser, getHostelLocations,
  getHostels, getRoles, getUsers, setUserActive
} from "../../services/api.js";

const emptyUser = { email: "", display_name: "", password: "", role_key: "warden" };
const emptyHostel = { hostel_code: "", hostel_name: "", address: "", contact_phone: "", gender_policy: "mixed" };

export default function Administration({ mode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activeHostel, setActiveHostel] = useState(getStoredHostelId() || "");
  const [userForm, setUserForm] = useState(emptyUser);
  const [hostelForm, setHostelForm] = useState(emptyHostel);
  const [buildingName, setBuildingName] = useState("");
  const [floorForm, setFloorForm] = useState({ building_id: "", floor_number: "", floor_name: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const canAddBranches = user?.permissions?.includes("hostels.manage");
  const canManageLocations = user?.permissions?.includes("rooms.manage");

  const load = async () => {
    setError("");
    try {
      const branchRows = await getHostels();
      setHostels(branchRows);
      const selected = branchRows.find((item) => String(item.hostel_id) === String(activeHostel)) || branchRows[0];
      if (selected && String(selected.hostel_id) !== String(activeHostel)) {
        setActiveHostel(String(selected.hostel_id));
        setStoredHostelId(selected.hostel_id);
      }
      if (mode === "team") {
        const [userRows, roleRows] = await Promise.all([getUsers(), getRoles()]);
        setUsers(userRows);
        setRoles(roleRows.filter((item) => item.role_key !== "student" && (user?.role_key === "super_admin" || item.role_key !== "super_admin")));
      } else {
        setLocations(await getHostelLocations());
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load this section.");
    }
  };

  useEffect(() => { load(); }, [mode]);

  const submit = async (event, action, message) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (mode === "team") return (
    <div className="admin-grid fade-in">
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">ACCESS CONTROL</span><h3>Create a team or parent account</h3></div><UserPlus size={20} /></div>
        <form className="stack-form" onSubmit={(event) => submit(event, async () => {
          await createUser(userForm);
          setUserForm(emptyUser);
        }, "Staff account created. Share its temporary password securely.")}>
          <Field label="Full name" value={userForm.display_name} onChange={(value) => setUserForm({ ...userForm, display_name: value })} required />
          <Field label="Email address" type="email" value={userForm.email} onChange={(value) => setUserForm({ ...userForm, email: value })} required />
          <label>Role<select value={userForm.role_key} onChange={(event) => setUserForm({ ...userForm, role_key: event.target.value })}>
            {roles.map((item) => <option key={item.role_key} value={item.role_key}>{item.display_name}</option>)}
          </select></label>
          {userForm.role_key === "parent" ? <p className="muted">Use the guardian email entered on the resident’s admission. This links the parent login to that resident.</p> : null}
          <Field label="Temporary password (8+ characters)" type="password" value={userForm.password} onChange={(value) => setUserForm({ ...userForm, password: value })} required />
          <button className="primary-button" disabled={saving}><Plus size={16} /> Create account</button>
        </form>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">CURRENT BRANCH</span><h3>Staff and access</h3></div></div>
        <div className="admin-list">
          {users.map((account) => <div className="admin-list-row" key={account.user_id}>
            <span className="admin-list-mark">{account.display_name?.[0] || "U"}</span>
            <div className="admin-list-copy"><strong>{account.display_name}</strong><small>{account.email} · {account.roles.join(", ")}</small></div>
            <button className={`text-button ${account.is_active ? "danger" : ""}`} type="button" onClick={async () => {
              await setUserActive(account.user_id, !account.is_active);
              await load();
            }}>{account.is_active ? "Deactivate" : "Reactivate"}</button>
          </div>)}
          {!users.length ? <p className="muted">No other accounts have branch access yet.</p> : null}
        </div>
      </article>
      {roles.length ? <article className="panel role-panel"><div className="panel-head"><div><span className="eyebrow">ROLE PERMISSIONS</span><h3>Available roles</h3></div></div>
        <div className="role-grid">{roles.map((item) => <div className="role-card" key={item.role_key}><strong>{item.display_name}</strong><small>{item.permissions.slice(0, 5).join(" · ")}{item.permissions.length > 5 ? ` · +${item.permissions.length - 5}` : ""}</small></div>)}</div>
      </article> : null}
      <Feedback error={error} notice={notice} />
    </div>
  );

  const buildings = locations.flatMap((item) => item.floors.map((floor) => ({ ...floor, building_id: item.building_id, building_name: item.building_name })));
  return (
    <div className="admin-grid fade-in">
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">BRANCH NETWORK</span><h3>Hostels</h3></div><Building2 size={20} /></div>
        <div className="branch-list">{hostels.map((item) => <button type="button" className={`branch-card ${String(item.hostel_id) === String(activeHostel) ? "selected" : ""}`} key={item.hostel_id} onClick={() => {
          setActiveHostel(String(item.hostel_id)); setStoredHostelId(item.hostel_id); window.location.reload();
        }}><strong>{item.hostel_name}</strong><small>{item.hostel_code} · {item.gender_policy}</small></button>)}</div>
        {canAddBranches ? <form className="stack-form inset-form" onSubmit={(event) => submit(event, async () => {
          const branch = await createHostel(hostelForm);
          setStoredHostelId(branch.hostel_id);
          setHostelForm(emptyHostel);
        }, "Branch created with its first building and floor.")}>
          <h4>Add hostel branch</h4>
          <Field label="Branch code" value={hostelForm.hostel_code} onChange={(value) => setHostelForm({ ...hostelForm, hostel_code: value })} required />
          <Field label="Branch name" value={hostelForm.hostel_name} onChange={(value) => setHostelForm({ ...hostelForm, hostel_name: value })} required />
          <Field label="Address" value={hostelForm.address} onChange={(value) => setHostelForm({ ...hostelForm, address: value })} />
          <label>Resident policy<select value={hostelForm.gender_policy} onChange={(event) => setHostelForm({ ...hostelForm, gender_policy: event.target.value })}><option value="mixed">Mixed</option><option value="male">Male</option><option value="female">Female</option></select></label>
          <button className="primary-button" disabled={saving}>Create branch</button>
        </form> : null}
      </article>
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">SPACE HIERARCHY</span><h3>Buildings and floors</h3></div></div>
        {canManageLocations ? <><form className="stack-form inset-form" onSubmit={(event) => submit(event, async () => {
          await createBuilding({ building_name: buildingName }); setBuildingName("");
        }, "Building added.")}>
          <h4>Add building</h4><Field label="Building name" value={buildingName} onChange={setBuildingName} required />
          <button className="secondary-button" disabled={saving}>Add building</button>
        </form>
        <form className="stack-form inset-form" onSubmit={(event) => submit(event, async () => {
          await createFloor({ ...floorForm, building_id: Number(floorForm.building_id), floor_number: Number(floorForm.floor_number) });
          setFloorForm({ building_id: "", floor_number: "", floor_name: "" });
        }, "Floor added.")}>
          <h4>Add floor</h4>
          <label>Building<select required value={floorForm.building_id} onChange={(event) => setFloorForm({ ...floorForm, building_id: event.target.value })}><option value="">Select a building</option>{locations.map((item) => <option key={item.building_id} value={item.building_id}>{item.building_name}</option>)}</select></label>
          <Field label="Floor number" type="number" value={floorForm.floor_number} onChange={(value) => setFloorForm({ ...floorForm, floor_number: value })} required />
          <Field label="Floor label" value={floorForm.floor_name} onChange={(value) => setFloorForm({ ...floorForm, floor_name: value })} />
          <button className="secondary-button" disabled={saving}>Add floor</button>
        </form></> : null}
        <div className="admin-list compact-list">{buildings.map((floor) => <div className="admin-list-row" key={floor.floor_id}><span className="admin-list-mark"><Building2 size={16} /></span><div className="admin-list-copy"><strong>{floor.building_name} · Floor {floor.floor_number}</strong><small>{floor.floor_name || "No label"}</small></div></div>)}{!buildings.length ? <p className="muted">No floors yet.</p> : null}</div>
      </article>
      <Feedback error={error} notice={notice} />
    </div>
  );
}

function Field({ label, type="text", value, onChange, required=false }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>;
}
function Feedback({ error, notice }) {
  return <>{error ? <p className="form-error full-span">{error}</p> : null}{notice ? <p className="success-message full-span">{notice}</p> : null}</>;
}

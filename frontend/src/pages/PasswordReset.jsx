import { useState } from "react";
import { ArrowUpRight, Building2, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { resetPassword } from "../services/api.js";

export default function PasswordReset() {
  const { updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (newPassword.length < 8) return setError("Choose a password with at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setSaving(true);
    try {
      await resetPassword({ currentPassword, newPassword });
      updateUser({ must_reset_password: false });
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update the password.");
    } finally { setSaving(false); }
  };

  return <main className="password-reset-page"><section className="password-reset-card fade-in">
    <div className="login-brand"><span className="login-brand-mark"><Building2 size={22} /></span><div><strong>Haven</strong><span>ACCOUNT SECURITY</span></div></div>
    <span className="story-kicker"><ShieldCheck size={15} /> FIRST SIGN-IN</span>
    <h1>Choose a new password</h1>
    <p className="login-intro">Your account was given an initial password. Change it to continue to your hostel workspace.</p>
    <form className="stack-form" onSubmit={submit}>
      <label>Current password<div className="input-icon"><Lock size={17} /><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div></label>
      <label>New password<div className="input-icon"><Lock size={17} /><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></div></label>
      <label>Confirm new password<div className="input-icon"><Lock size={17} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></div></label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-button" disabled={saving}>{saving ? "Saving..." : <>Update password <ArrowUpRight size={17} /></>}</button>
    </form>
    <button className="text-button" type="button" onClick={logout}>Sign out</button>
  </section></main>;
}

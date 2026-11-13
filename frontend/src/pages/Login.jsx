import { ArrowUpRight, Building2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "", role: "student" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const showDemoAccess = import.meta.env.VITE_SHOW_DEMO_CREDENTIALS !== "false";

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const useDemoAccount = (role) => {
    setForm({
      role,
      identifier: role === "admin" ? "admin@hostel.com" : "1",
      password: role === "admin" ? "admin123" : "student123"
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await login(form);
      navigate(user.role === "admin" ? "/admin" : user.role === "parent" ? "/parent" : "/student", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell fade-in">
        <div className="login-story">
          <div className="login-brand">
            <span className="login-brand-mark"><Building2 size={22} /></span>
            <div>
              <strong>Haven</strong>
              <span>HOSTEL MANAGEMENT</span>
            </div>
          </div>

          <div className="login-story-copy">
            <span className="story-kicker"><Sparkles size={14} /> YOUR CAMPUS, IN SYNC</span>
            <h2>A better stay starts <em>here.</em></h2>
            <p>One calm place to keep up with rooms, requests, payments, and everything happening around your hostel.</p>
          </div>

          <div className="story-board" aria-hidden="true">
            <div className="story-orbit orbit-one" />
            <div className="story-orbit orbit-two" />
            <div className="story-building">
              <div className="building-roof" />
              <div className="building-body">
                <span /><span /><span />
                <span /><span /><span />
                <b />
              </div>
              <div className="building-base" />
            </div>
            <div className="story-note note-top"><span className="note-dot" /> A place to feel at home</div>
            <div className="story-note note-bottom"><ShieldCheck size={16} /><span>Everything in one place</span><ArrowUpRight size={15} /></div>
          </div>

          <div className="login-story-footer">
            <span>MADE FOR EVERYDAY CAMPUS LIFE</span>
            <span>01 — 03</span>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-card">
            <span className="eyebrow">WELCOME BACK</span>
            <h1>Sign in to your space</h1>
            <p className="login-intro">Pick up where you left off.</p>

            <form onSubmit={handleSubmit}>
              <label>
                I’m signing in as
                <div className="segmented-control">
                  <button className={form.role === "student" ? "selected" : ""} type="button" onClick={() => updateField("role", "student")}>
                    Student
                  </button>
                  <button className={form.role === "parent" ? "selected" : ""} type="button" onClick={() => updateField("role", "parent")}>Parent</button>
                  <button className={form.role === "admin" ? "selected" : ""} type="button" onClick={() => updateField("role", "admin")}>
                    Admin
                  </button>
                </div>
              </label>

              <label>
                {form.role === "student" ? "Email or student ID" : "Email address"}
                <div className="input-icon">
                  <Mail size={18} />
                  <input
                    value={form.identifier}
                    onChange={(event) => updateField("identifier", event.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder={form.role === "student" ? "Email address or student ID" : form.role === "parent" ? "Parent email address" : "admin@hostel.com"}
                    required
                  />
                </div>
              </label>

              <label>
                Password
                <div className="input-icon">
                  <Lock size={18} />
                  <input
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {error ? <p className="form-error">{error}</p> : null}

              <button className="primary-button login-submit" type="submit" disabled={loading}>
                {loading ? "Signing in..." : <>Continue <ArrowUpRight size={17} /></>}
              </button>
            </form>

            {showDemoAccess ? <div className="demo-access">
              <div className="demo-access-heading">
                <span>DEMO ACCESS</span>
                <span>LOCAL DATABASE</span>
              </div>
              <button type="button" onClick={() => useDemoAccount("admin")}>
                <span className="demo-avatar admin-demo">AD</span>
                <span className="demo-account-copy"><strong>Administrator</strong><small>admin@hostel.com <i>·</i> admin123</small></span>
                <ArrowUpRight size={16} />
              </button>
              <button type="button" onClick={() => useDemoAccount("student")}>
                <span className="demo-avatar student-demo">ST</span>
                <span className="demo-account-copy"><strong>Student</strong><small>ID 1 <i>·</i> student123</small></span>
                <ArrowUpRight size={16} />
              </button>
              <p>Choose an account to fill the sign-in form. Demo database setup is required.</p>
            </div> : null}

            <div className="login-security"><ShieldCheck size={16} /><span>Your account is protected with secure sign-in.</span></div>
          </div>
          <p className="login-help">Need access? Contact your hostel administrator.</p>
        </div>
      </section>
    </main>
  );
}

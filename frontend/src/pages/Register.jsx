import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import GroupBadge from "../components/GroupBadge";
import { toast } from "sonner";

const WORKDAY_MODULES = ["Core HCM","Compensation","Benefits","Absence","Recruiting","Talent","Payroll","Security","Integrations","Reporting","Financials"];

export default function Register() {
  const [step, setStep] = useState(1);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", password: "",
    group_type: "", workday_modules: [], years_experience: "", bio: "",
    company_name: "", current_role: "", employment_type: "", company_role: "",
    here_for: "", company_size: "", goals: "",
  });
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user, refresh } = useAuth();
  const navigate = useNavigate();

  // Check if registrations are open
  useEffect(() => {
    api.get("/settings/public")
      .then((r) => setRegistrationsOpen((r.data?.registrations_open || "true") !== "false"))
      .catch(() => {});
  }, []);

  // Auto-suggest username from name
  useEffect(() => {
    if (form.full_name && !form.username) {
      const suggested = form.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
      setForm((f) => ({ ...f, username: suggested }));
    }
    // eslint-disable-next-line
  }, [form.full_name]);

  // Live username check
  useEffect(() => {
    if (!form.username || form.username.length < 3) { setUsernameAvailable(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/auth/check-username", { username: form.username });
        setUsernameAvailable(data.available);
      } catch { setUsernameAvailable(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleModule = (m) => setForm((f) => ({
    ...f, workday_modules: f.workday_modules.includes(m) ? f.workday_modules.filter((x) => x !== m) : [...f.workday_modules, m]
  }));

  const submitStep1 = async (e) => {
    e.preventDefault();
    setError("");
    if (usernameAvailable === false) { setError("Username already taken."); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        full_name: form.full_name, username: form.username, email: form.email, password: form.password,
      });
      login(data);
      setStep(2);
    } catch (e) {
      setError(formatApiError(e));
    } finally { setLoading(false); }
  };

  const submitGroup = () => {
    if (!form.group_type) { setError("Please choose a group."); return; }
    setError("");
    setStep(3);
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        group_type: form.group_type,
        workday_modules: form.workday_modules,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        bio: form.bio || null,
        company_name: form.company_name || null,
        current_role: form.current_role || null,
        employment_type: form.employment_type || null,
        company_role: form.company_role || null,
        here_for: form.here_for || null,
        company_size: form.company_size || null,
        goals: form.goals || null,
      };
      const updated = await api.post("/profile/setup", payload);
      await refresh();
      setStep(4);
    } catch (e) {
      setError(formatApiError(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="register-page">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0A1628]">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-20">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center" data-testid="step-indicator">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`w-8 h-1 rounded-full transition-colors ${step >= n ? "bg-[#0D9373]" : "bg-[#E2E8F0]"}`} />
          ))}
        </div>

        {step === 1 && !registrationsOpen && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center" data-testid="waitlist">
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">We're at capacity right now.</h1>
            <p className="text-[#64748B] mt-3 max-w-md mx-auto">New registrations are temporarily paused while we onboard our current wave of members. Check back soon — we'll re-open quickly.</p>
            <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#0A1628] hover:bg-[#F8FAFC]">Back to home</Link>
          </div>
        )}

        {step === 1 && registrationsOpen && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8" data-testid="step-1">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-2">Step 1 of 4</div>
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Create your account</h1>
            <p className="text-sm text-[#64748B] mt-1">Start with the basics.</p>
            <form onSubmit={submitStep1} className="mt-6 flex flex-col gap-4">
              <Field label="Full name" required>
                <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className="input" data-testid="register-fullname" />
              </Field>
              <Field label="Username" required hint={form.username && (usernameAvailable === true ? "✓ Available" : usernameAvailable === false ? "✗ Taken" : "Checking...")} hintColor={usernameAvailable === true ? "text-[#16A34A]" : usernameAvailable === false ? "text-[#DC2626]" : "text-[#94A3B8]"}>
                <input required pattern="[a-z0-9_]{3,30}" value={form.username} onChange={(e) => update("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="input" data-testid="register-username" />
              </Field>
              <Field label="Email" required>
                <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="input" data-testid="register-email" />
              </Field>
              <Field label="Password" required hint="Min 8 characters">
                <input required type="password" minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} className="input" data-testid="register-password" />
              </Field>
              {error && <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5" data-testid="register-error">{error}</div>}
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                By creating an account, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0D9373] hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0D9373] hover:underline">Privacy Policy</a>.
              </p>
              <button disabled={loading} className="mt-2 w-full py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm transition-colors disabled:opacity-60" data-testid="step1-continue">
                {loading ? "Creating..." : "Continue"} <ArrowRight className="inline w-4 h-4 ml-1" />
              </button>
              <p className="text-center text-sm text-[#64748B]">Already have an account? <Link to="/login" className="text-[#0D9373] hover:underline font-medium">Sign in</Link></p>
            </form>
          </div>
        )}

        {step === 2 && (
          <div data-testid="step-2">
            <div className="text-center mb-6">
              <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-2">Step 2 of 4</div>
              <h1 className="font-heading text-3xl font-semibold text-[#0A1628]">Choose your group</h1>
              <p className="text-sm text-[#64748B] mt-2">This shapes your experience — and tells the community where you're coming from.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { id: "aspirant", title: "Aspirant", color: "#0D9373", desc: "I'm learning Workday or breaking into the ecosystem.", bullets: ["0–3 yrs Workday exposure", "Career changers welcome", "Get peer support + answers"] },
                { id: "practitioner", title: "Practitioner", color: "#1D6FE8", desc: "I'm a Workday consultant, dev, or architect.", bullets: ["3–10+ yrs experience", "Employed or freelance", "Debate, share, get noticed"] },
                { id: "employer", title: "Employer", color: "#C47B0A", desc: "I represent a company or consulting firm.", bullets: ["Hiring Workday talent", "Boutique firm or in-house", "Spot signal, build brand"] },
              ].map((g) => {
                const selected = form.group_type === g.id;
                return (
                  <button
                    key={g.id} type="button" onClick={() => update("group_type", g.id)}
                    data-testid={`select-group-${g.id}`}
                    className={`text-left p-6 rounded-xl border-2 transition-all bg-white ${selected ? "shadow-md" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                    style={selected ? { borderColor: g.color } : {}}
                  >
                    <GroupBadge group={g.id} size="lg" />
                    <h3 className="font-heading font-semibold text-lg text-[#0A1628] mt-3">{g.title}</h3>
                    <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{g.desc}</p>
                    <ul className="mt-4 space-y-1.5">
                      {g.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#475569]">
                          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: g.color }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            {error && <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5 mt-4 text-center">{error}</div>}
            <div className="flex gap-3 mt-6 justify-center">
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-white">Back</button>
              <button onClick={submitGroup} disabled={!form.group_type} className="px-6 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium disabled:opacity-50" data-testid="step2-continue">
                Continue <ArrowRight className="inline w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8" data-testid="step-3">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-2">Step 3 of 4</div>
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Tell us about yourself</h1>
            <p className="text-sm text-[#64748B] mt-1">A few details to set up your profile. You can edit anytime.</p>
            <form onSubmit={submitProfile} className="mt-6 flex flex-col gap-5">
              {form.group_type === "aspirant" && (
                <>
                  <Field label="Current role or background"><input value={form.current_role} onChange={(e) => update("current_role", e.target.value)} className="input" placeholder="HR Operations Analyst" /></Field>
                  <ModulesField selected={form.workday_modules} toggle={toggleModule} label="Workday modules you're interested in" />
                  <Field label="Years of HR / IT experience"><input type="number" min="0" value={form.years_experience} onChange={(e) => update("years_experience", e.target.value)} className="input" /></Field>
                  <Field label="What are you hoping to achieve?"><textarea value={form.goals} onChange={(e) => update("goals", e.target.value)} className="input min-h-[80px]" /></Field>
                </>
              )}
              {form.group_type === "practitioner" && (
                <>
                  <ModulesField selected={form.workday_modules} toggle={toggleModule} label="Workday modules you're certified or experienced in" />
                  <Field label="Years of Workday-specific experience"><input type="number" min="0" value={form.years_experience} onChange={(e) => update("years_experience", e.target.value)} className="input" /></Field>
                  <Field label="Employment type">
                    <select value={form.employment_type} onChange={(e) => update("employment_type", e.target.value)} className="input">
                      <option value="">Select...</option>
                      <option>Employed full-time</option>
                      <option>Freelance / Independent</option>
                      <option>Both</option>
                      <option>Open to opportunities</option>
                    </select>
                  </Field>
                  <Field label="Brief bio (2–3 sentences)"><textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} className="input min-h-[100px]" /></Field>
                </>
              )}
              {form.group_type === "employer" && (
                <>
                  <Field label="Company / firm name" required><input required value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className="input" /></Field>
                  <Field label="Your role at the company"><input value={form.company_role} onChange={(e) => update("company_role", e.target.value)} className="input" placeholder="Talent Acquisition Lead" /></Field>
                  <Field label="What brings you here?">
                    <select value={form.here_for} onChange={(e) => update("here_for", e.target.value)} className="input">
                      <option value="">Select...</option>
                      <option>Hiring talent</option>
                      <option>Finding freelancers</option>
                      <option>Staying current</option>
                      <option>Contributing knowledge</option>
                      <option>Other</option>
                    </select>
                  </Field>
                  <Field label="Company size">
                    <select value={form.company_size} onChange={(e) => update("company_size", e.target.value)} className="input">
                      <option value="">Select...</option>
                      <option>1–10</option>
                      <option>11–50</option>
                      <option>51–200</option>
                      <option>201–1000</option>
                      <option>1000+</option>
                    </select>
                  </Field>
                </>
              )}
              {error && <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5">{error}</div>}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#475569]">Back</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm disabled:opacity-60" data-testid="step3-continue">
                  {loading ? "Saving..." : "Continue"} <ArrowRight className="inline w-4 h-4 ml-1" />
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center" data-testid="step-4">
            <div className="flex justify-center mb-4">
              <GroupBadge group={form.group_type} size="lg" />
            </div>
            <h1 className="font-heading text-3xl font-semibold text-[#0A1628]">You're in, {form.full_name?.split(" ")[0]}.</h1>
            <p className="text-[#64748B] mt-2 max-w-md mx-auto">Your profile is live and the community can see you. Here's where to start.</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-8 text-left">
              {(form.group_type === "aspirant" ? [
                { label: "Ask your first question", to: "/community/new-post", desc: "No judgment. The best practitioners started here." },
                { label: "Follow your modules", to: "/community", desc: "Browse spaces and bookmark what's relevant." },
                { label: "Read top success stories", to: "/community?type=success_story", desc: "See how practitioners solved hard problems." },
              ] : form.group_type === "practitioner" ? [
                { label: "Answer an unanswered question", to: "/community?unanswered=1", desc: "Build reputation fast by helping aspirants." },
                { label: "Share a success story", to: "/community/new-post", desc: "Document a hard fix you're proud of." },
                { label: "Join module discussions", to: "/community", desc: "Architecture debates need your voice." },
              ] : [
                { label: "Complete your firm profile", to: "/profile/" + form.username, desc: "Show practitioners who you are." },
                { label: "Answer aspirant questions", to: "/community?type=question", desc: "Build brand. Spot talent." },
                { label: "Browse top contributors", to: "/community", desc: "See who's active and where." },
              ]).map((a, i) => (
                <Link key={i} to={a.to} className="block p-4 rounded-lg border border-[#E2E8F0] hover:border-[#0D9373] bg-[#F8FAFC] hover:bg-white transition-colors">
                  <div className="font-medium text-sm text-[#0A1628]">{a.label}</div>
                  <div className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{a.desc}</div>
                </Link>
              ))}
            </div>
            <button onClick={() => navigate("/community")} className="mt-8 px-6 py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium text-sm" data-testid="step4-go-community">
              Go to community <ArrowRight className="inline w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #E2E8F0;background:white;font-size:0.875rem;outline:none;}.input:focus{border-color:#0D9373;box-shadow:0 0 0 3px rgba(13,147,115,0.15);}`}</style>
    </div>
  );
}

function Field({ label, required, hint, hintColor, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-[#475569]">{label}{required && <span className="text-[#DC2626]">*</span>}</label>
        {hint && <span className={`text-xs ${hintColor || "text-[#94A3B8]"}`}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ModulesField({ selected, toggle, label }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#475569]">{label}</label>
      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="modules-grid">
        {WORKDAY_MODULES.map((m) => {
          const on = selected.includes(m);
          return (
            <button
              type="button" key={m} onClick={() => toggle(m)}
              data-testid={`module-${m.replace(/\s/g, "-")}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#0D9373] text-white border-[#0D9373]" : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#94A3B8]"}`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

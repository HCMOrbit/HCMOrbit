import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const update = (k, v) => { setSettings({ ...settings, [k]: String(v) }); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/admin/settings", settings);
      toast.success("Settings saved.");
      setDirty(false);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Settings</h1>
          <p className="text-sm text-[#64748B]">Configure community-wide behavior.</p>
        </div>
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50" data-testid="settings-save-btn">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Community */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <h2 className="font-heading font-semibold text-[#0A1628]">Community</h2>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Community name">
              <input value={settings.community_name || ""} onChange={(e) => update("community_name", e.target.value)} className="input" data-testid="setting-community-name" />
            </Field>
            <Field label="Tagline">
              <input value={settings.community_tagline || ""} onChange={(e) => update("community_tagline", e.target.value)} className="input" data-testid="setting-community-tagline" />
            </Field>
          </div>
        </section>

        {/* Registration */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <h2 className="font-heading font-semibold text-[#0A1628]">Registration</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Toggle label="Allow new registrations"
              hint="If off, the registration page shows a waitlist message."
              value={(settings.registrations_open || "true") === "true"}
              onChange={(v) => update("registrations_open", v ? "true" : "false")}
              testid="setting-registrations-open"
            />
            <Toggle label="Require email verification before posting"
              hint="Reserved for future use — currently does not enforce."
              value={(settings.require_email_verification || "false") === "true"}
              onChange={(v) => update("require_email_verification", v ? "true" : "false")}
              testid="setting-require-email"
            />
          </div>
        </section>

        {/* Moderation */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 lg:col-span-2">
          <h2 className="font-heading font-semibold text-[#0A1628]">Moderation thresholds</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <Field label="Minimum reputation to downvote">
              <input type="number" min="0" value={settings.min_rep_downvote || "0"} onChange={(e) => update("min_rep_downvote", e.target.value)} className="input" data-testid="setting-min-rep-downvote" />
              <div className="text-xs text-[#94A3B8] mt-1.5">Users with less reputation cannot cast downvotes. Default: 0.</div>
            </Field>
            <Field label="Minimum reputation to post in any space">
              <input type="number" min="0" value={settings.min_rep_post || "0"} onChange={(e) => update("min_rep_post", e.target.value)} className="input" data-testid="setting-min-rep-post" />
              <div className="text-xs text-[#94A3B8] mt-1.5">Set 0 to allow all onboarded users to post. Default: 0.</div>
            </Field>
          </div>
        </section>
      </div>

      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #E2E8F0;background:white;font-size:0.875rem;outline:none;}.input:focus{border-color:#0D9373;box-shadow:0 0 0 3px rgba(13,147,115,0.15);}`}</style>
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#475569]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Toggle({ label, hint, value, onChange, testid }) {
  return (
    <button
      type="button" onClick={() => onChange(!value)}
      className="flex items-start gap-3 text-left py-2 hover:bg-[#F8FAFC] rounded-md px-2 -mx-2"
      data-testid={testid}
    >
      <div className={`mt-0.5 w-10 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${value ? "bg-[#0D9373]" : "bg-[#E2E8F0]"}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[#0F172A]">{label}</div>
        {hint && <div className="text-xs text-[#64748B] mt-0.5">{hint}</div>}
      </div>
    </button>
  );
}

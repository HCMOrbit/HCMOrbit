/**
 * Admin > Industry Pulse intelligence manager.
 *
 * Four sub-sections:
 *   1. Sources     — CRUD for public data sources (Phase 2 crawl targets)
 *   2. Go-Lives    — approval queue + manual add
 *   3. Events      — approval queue + manual add
 *   4. Scores      — inline override for module adoption percentages
 *
 * Uses existing AdminLayout so it inherits the sidebar / access guard.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RefreshCcw, Check, X, Edit3, Save } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "go-lives", label: "Go-Lives" },
  { id: "events", label: "Events" },
  { id: "scores", label: "Module Scores" },
];

const INDUSTRIES = [
  "Healthcare", "Financial Services", "Retail", "Technology", "Manufacturing",
  "Public Sector", "Higher Education", "Professional Services",
];

const SOURCE_TYPES = [
  "press_release", "blog", "event", "rug", "partner",
  "job_board", "customer_story", "community", "other",
];

export default function AdminEcosystemIntelligence() {
  const [tab, setTab] = useState("sources");
  return (
    <AdminLayout>
      <div className="mb-6" data-testid="admin-intel-page">
        <h1 className="text-2xl font-bold text-[#0A1628]">Industry Pulse Intelligence</h1>
        <p className="text-sm text-[#475569] mt-1">
          Manage public data sources, review customer go-lives and events, and override module adoption scores.
          Phase 1 uses sample seed data; Phase 2 will replace it with real crawled signals.
        </p>
      </div>

      <div className="border-b border-[#E2E8F0] mb-6 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition ${tab === t.id ? "text-[#0D9373] border-[#0D9373]" : "text-[#64748B] border-transparent hover:text-[#0A1628]"}`}
            data-testid={`admin-intel-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sources" && <SourcesTab />}
      {tab === "go-lives" && <GoLivesTab />}
      {tab === "events" && <EventsTab />}
      {tab === "scores" && <ScoresTab />}
    </AdminLayout>
  );
}

// ---------- Sources ---------------------------------------------------------
function SourcesTab() {
  const [rows, setRows] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    source_name: "", source_type: "press_release", source_url: "",
    crawl_frequency: "weekly", enabled: true, reliability_score: 70, notes: "",
  });

  const load = () => api.get("/admin/intel/sources").then((r) => setRows(r.data.sources));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post("/admin/intel/sources", form);
      toast.success("Source added");
      setCreating(false);
      setForm({ source_name: "", source_type: "press_release", source_url: "", crawl_frequency: "weekly", enabled: true, reliability_score: 70, notes: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const toggle = async (id, enabled) => {
    try { await api.patch(`/admin/intel/sources/${id}`, { enabled }); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const trigger = async (id) => {
    try {
      const r = await api.post(`/admin/intel/sources/${id}/trigger-crawl`);
      toast.info(r.data.note || "Crawl triggered");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this source?")) return;
    try { await api.delete(`/admin/intel/sources/${id}`); load(); toast.success("Removed"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid="admin-intel-sources">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-[#0A1628]">Data sources</h2>
          <p className="text-xs text-[#64748B]">Public sources the Phase 2 crawler will pull from. Each row respects robots.txt.</p>
        </div>
        <button onClick={() => setCreating((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#0D9373] text-white text-sm font-medium hover:bg-[#0B7D63]"
                data-testid="admin-intel-source-add-toggle">
          <Plus className="w-4 h-4" /> {creating ? "Cancel" : "Add source"}
        </button>
      </div>

      {creating && (
        <div className="mb-5 p-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Name">
              <input className="input" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} data-testid="admin-intel-source-name" />
            </Field>
            <Field label="Type">
              <select className="input" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="URL">
              <input className="input" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} data-testid="admin-intel-source-url" />
            </Field>
            <Field label="Frequency">
              <select className="input" value={form.crawl_frequency} onChange={(e) => setForm({ ...form, crawl_frequency: e.target.value })}>
                {["daily", "weekly", "monthly"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Reliability (0-100)">
              <input type="number" className="input" min="0" max="100" value={form.reliability_score}
                     onChange={(e) => setForm({ ...form, reliability_score: parseInt(e.target.value || 0, 10) })} />
            </Field>
            <Field label="Notes">
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#475569]">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
          <button onClick={submit} className="px-4 py-2 rounded bg-[#0A1628] text-white text-sm font-medium"
                  data-testid="admin-intel-source-submit">
            Save source
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-intel-sources-table">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">URL</th>
              <th className="py-2 pr-3">Freq</th>
              <th className="py-2 pr-3">Reliability</th>
              <th className="py-2 pr-3">Last</th>
              <th className="py-2 pr-3">Enabled</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-[#F1F5F9]">
                <td className="py-2 pr-3 font-medium text-[#0F172A]">{s.source_name}</td>
                <td className="py-2 pr-3 text-[#475569]">{s.source_type}</td>
                <td className="py-2 pr-3 text-xs text-[#0D9373] truncate max-w-[240px]">
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="hover:underline">{s.source_url}</a>
                </td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{s.crawl_frequency}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{s.reliability_score}</td>
                <td className="py-2 pr-3 text-xs text-[#94A3B8]">{s.last_status}</td>
                <td className="py-2 pr-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#475569]">
                    <input type="checkbox" checked={!!s.enabled} onChange={(e) => toggle(s.id, e.target.checked)} />
                    {s.enabled ? "On" : "Off"}
                  </label>
                </td>
                <td className="py-2 text-right space-x-2">
                  <button onClick={() => trigger(s.id)} title="Trigger crawl (Phase 2 stub)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#F1F5F9] hover:bg-[#E2E8F0]"
                          data-testid={`admin-intel-source-trigger-${s.id}`}>
                    <RefreshCcw className="w-3 h-3" /> Crawl
                  </button>
                  <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[#B91C1C] hover:bg-[#FEE2E2]">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="8" className="py-6 text-center text-xs text-[#94A3B8]">No sources yet. Add one to seed the Phase 2 crawler.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`.input { width: 100%; padding: 8px 10px; border: 1px solid #CBD5E0; border-radius: 6px; background: #fff; font-size: 13px; }`}</style>
    </div>
  );
}

// ---------- Go-Lives --------------------------------------------------------
function GoLivesTab() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [industry, setIndustry] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", industry: "Healthcare", region: "Americas",
    modules: [], source_url: "", source_name: "", announcement_date: "",
    confidence_score: 70,
  });

  const load = () => {
    const qs = new URLSearchParams();
    if (filter !== "all") qs.set("status", filter);
    if (industry) qs.set("industry", industry);
    return api.get(`/admin/intel/go-lives?${qs}`).then((r) => setRows(r.data.go_lives));
  };
  useEffect(() => { load(); }, [filter, industry]);

  const setStatus = async (id, status) => {
    try { await api.patch(`/admin/intel/go-lives/${id}`, { status }); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const submit = async () => {
    try {
      const modules = form.modules === "" || Array.isArray(form.modules) ? form.modules : String(form.modules).split(",").map((s) => s.trim()).filter(Boolean);
      await api.post("/admin/intel/go-lives", { ...form, modules });
      toast.success("Go-live added");
      setCreating(false);
      setForm({ customer_name: "", industry: "Healthcare", region: "Americas", modules: [], source_url: "", source_name: "", announcement_date: "", confidence_score: 70 });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid="admin-intel-golives">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[#0A1628]">Customer go-lives</h2>
          <p className="text-xs text-[#64748B]">Approve or reject go-lives before they appear on Industry Pulse.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="admin-intel-golives-status">
            {["all", "sample_data", "approved", "pending", "rejected"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="input w-auto" value={industry} onChange={(e) => setIndustry(e.target.value)} data-testid="admin-intel-golives-industry">
            <option value="">All industries</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button onClick={() => setCreating((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#0D9373] text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> {creating ? "Cancel" : "Add go-live"}
          </button>
        </div>
      </div>

      {creating && (
        <div className="mb-5 p-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Customer name"><input className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
            <Field label="Industry">
              <select className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Region">
              <select className="input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {["Americas", "EMEA", "APAC"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Modules (comma-separated)">
              <input className="input" value={Array.isArray(form.modules) ? form.modules.join(", ") : form.modules}
                     onChange={(e) => setForm({ ...form, modules: e.target.value })} />
            </Field>
            <Field label="Source URL"><input className="input" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></Field>
            <Field label="Source name"><input className="input" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} /></Field>
            <Field label="Announcement date (YYYY-MM-DD)"><input className="input" value={form.announcement_date} onChange={(e) => setForm({ ...form, announcement_date: e.target.value })} /></Field>
            <Field label="Confidence (0-100)"><input type="number" className="input" min="0" max="100" value={form.confidence_score} onChange={(e) => setForm({ ...form, confidence_score: parseInt(e.target.value || 0, 10) })} /></Field>
          </div>
          <button onClick={submit} className="mt-3 px-4 py-2 rounded bg-[#0A1628] text-white text-sm font-medium">Save</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Industry</th>
              <th className="py-2 pr-3">Region</th>
              <th className="py-2 pr-3">Modules</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Confidence</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="border-b border-[#F1F5F9]">
                <td className="py-2 pr-3 font-medium text-[#0F172A]">{g.customer_name}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{g.industry}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{g.region}</td>
                <td className="py-2 pr-3 text-xs text-[#475569] max-w-[200px] truncate">{(g.modules || []).join(", ")}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{g.announcement_date}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{g.confidence_score}</td>
                <td className="py-2 pr-3 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">{g.status}</span>
                </td>
                <td className="py-2 text-right space-x-1">
                  {g.status !== "approved" && (
                    <button onClick={() => setStatus(g.id, "approved")} className="p-1 rounded hover:bg-[#DCFCE7] text-[#166534]" title="Approve"><Check className="w-4 h-4" /></button>
                  )}
                  {g.status !== "rejected" && (
                    <button onClick={() => setStatus(g.id, "rejected")} className="p-1 rounded hover:bg-[#FEE2E2] text-[#B91C1C]" title="Reject"><X className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="8" className="py-6 text-center text-xs text-[#94A3B8]">No go-lives match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`.input { width: 100%; padding: 8px 10px; border: 1px solid #CBD5E0; border-radius: 6px; background: #fff; font-size: 13px; }`}</style>
    </div>
  );
}

// ---------- Events ----------------------------------------------------------
function EventsTab() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "", event_type: "Webinar", start_date: "", end_date: "",
    location: "", virtual: false, registration_url: "", source_url: "",
    industry_tags: [], module_tags: [],
  });

  const load = () => {
    const qs = filter === "all" ? "" : `?status=${filter}`;
    return api.get(`/admin/intel/events${qs}`).then((r) => setRows(r.data.events));
  };
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status) => {
    try { await api.patch(`/admin/intel/events/${id}`, { status }); load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const submit = async () => {
    try {
      const parseTags = (v) => Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);
      await api.post("/admin/intel/events", {
        ...form,
        industry_tags: parseTags(form.industry_tags),
        module_tags: parseTags(form.module_tags),
      });
      toast.success("Event added");
      setCreating(false);
      setForm({ title: "", event_type: "Webinar", start_date: "", end_date: "", location: "", virtual: false, registration_url: "", source_url: "", industry_tags: [], module_tags: [] });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid="admin-intel-events">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[#0A1628]">Ecosystem events</h2>
          <p className="text-xs text-[#64748B]">Curate the events shown in the Industry Pulse &ldquo;Upcoming events&rdquo; card.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["all", "sample_data", "approved", "pending", "rejected"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => setCreating((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#0D9373] text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> {creating ? "Cancel" : "Add event"}
          </button>
        </div>
      </div>

      {creating && (
        <div className="mb-5 p-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Type">
              <select className="input" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {["Conference", "Webinar", "RUG", "Workshop", "Partner Event", "Roundtable"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Start (YYYY-MM-DD)"><input className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="End (YYYY-MM-DD)"><input className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Registration URL"><input className="input" value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })} /></Field>
            <Field label="Industry tags (comma-separated)"><input className="input" value={Array.isArray(form.industry_tags) ? form.industry_tags.join(", ") : form.industry_tags} onChange={(e) => setForm({ ...form, industry_tags: e.target.value })} /></Field>
            <Field label="Module tags"><input className="input" value={Array.isArray(form.module_tags) ? form.module_tags.join(", ") : form.module_tags} onChange={(e) => setForm({ ...form, module_tags: e.target.value })} /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-[#475569]">
            <input type="checkbox" checked={form.virtual} onChange={(e) => setForm({ ...form, virtual: e.target.checked })} /> Virtual
          </label>
          <button onClick={submit} className="mt-3 px-4 py-2 rounded bg-[#0A1628] text-white text-sm font-medium">Save</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Start</th>
              <th className="py-2 pr-3">Location</th>
              <th className="py-2 pr-3">Industry tags</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ev) => (
              <tr key={ev.id} className="border-b border-[#F1F5F9]">
                <td className="py-2 pr-3 font-medium text-[#0F172A]">{ev.title}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{ev.event_type}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{ev.start_date}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{ev.virtual ? "Virtual" : ev.location}</td>
                <td className="py-2 pr-3 text-xs text-[#475569] max-w-[220px] truncate">{(ev.industry_tags || []).join(", ")}</td>
                <td className="py-2 pr-3 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">{ev.status}</span>
                </td>
                <td className="py-2 text-right space-x-1">
                  {ev.status !== "approved" && (
                    <button onClick={() => setStatus(ev.id, "approved")} className="p-1 rounded hover:bg-[#DCFCE7] text-[#166534]"><Check className="w-4 h-4" /></button>
                  )}
                  {ev.status !== "rejected" && (
                    <button onClick={() => setStatus(ev.id, "rejected")} className="p-1 rounded hover:bg-[#FEE2E2] text-[#B91C1C]"><X className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="7" className="py-6 text-center text-xs text-[#94A3B8]">No events match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`.input { width: 100%; padding: 8px 10px; border: 1px solid #CBD5E0; border-radius: 6px; background: #fff; font-size: 13px; }`}</style>
    </div>
  );
}

// ---------- Module scores ---------------------------------------------------
function ScoresTab() {
  const [industry, setIndustry] = useState("Healthcare");
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});

  const load = () => api.get(`/admin/intel/module-scores?industry=${encodeURIComponent(industry)}`).then((r) => setRows(r.data.scores));
  useEffect(() => { load(); }, [industry]);

  const startEdit = (row) => {
    setEdits({ ...edits, [row.id]: { h: row.high_adoption_percent, a: row.adopting_percent, e: row.early_adoption_percent } });
  };

  const cancel = (id) => { const c = { ...edits }; delete c[id]; setEdits(c); };

  const save = async (id) => {
    const ed = edits[id];
    const sum = (ed.h || 0) + (ed.a || 0) + (ed.e || 0);
    if (sum !== 100) { toast.error(`Percents must sum to 100 (got ${sum})`); return; }
    try {
      await api.patch(`/admin/intel/module-scores/${id}`, {
        high_adoption_percent: ed.h, adopting_percent: ed.a, early_adoption_percent: ed.e,
      });
      toast.success("Score updated");
      cancel(id);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid="admin-intel-scores">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[#0A1628]">Module adoption scores</h2>
          <p className="text-xs text-[#64748B]">Override the three percentages per (industry, module). They must sum to 100.</p>
        </div>
        <select className="input w-auto" value={industry} onChange={(e) => setIndustry(e.target.value)} data-testid="admin-intel-scores-industry">
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="py-2 pr-3">Module</th>
              <th className="py-2 pr-3">High</th>
              <th className="py-2 pr-3">Adopting</th>
              <th className="py-2 pr-3">Early</th>
              <th className="py-2 pr-3">Demand</th>
              <th className="py-2 pr-3">Trend</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ed = edits[r.id];
              return (
                <tr key={r.id} className="border-b border-[#F1F5F9]">
                  <td className="py-2 pr-3 font-medium text-[#0F172A]">{r.module}</td>
                  <td className="py-2 pr-3">
                    {ed ? <input type="number" min="0" max="100" className="input w-20" value={ed.h}
                                 onChange={(e) => setEdits({ ...edits, [r.id]: { ...ed, h: parseInt(e.target.value || 0, 10) } })} />
                       : `${r.high_adoption_percent}%`}
                  </td>
                  <td className="py-2 pr-3">
                    {ed ? <input type="number" min="0" max="100" className="input w-20" value={ed.a}
                                 onChange={(e) => setEdits({ ...edits, [r.id]: { ...ed, a: parseInt(e.target.value || 0, 10) } })} />
                       : `${r.adopting_percent}%`}
                  </td>
                  <td className="py-2 pr-3">
                    {ed ? <input type="number" min="0" max="100" className="input w-20" value={ed.e}
                                 onChange={(e) => setEdits({ ...edits, [r.id]: { ...ed, e: parseInt(e.target.value || 0, 10) } })} />
                       : `${r.early_adoption_percent}%`}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[#475569]">{r.demand_level}</td>
                  <td className="py-2 pr-3 text-xs text-[#475569]">{r.trend_direction}</td>
                  <td className="py-2 pr-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">{r.status}</span>
                  </td>
                  <td className="py-2 text-right space-x-1">
                    {ed ? (
                      <>
                        <button onClick={() => save(r.id)} className="p-1 rounded hover:bg-[#DCFCE7] text-[#166534]"><Save className="w-4 h-4" /></button>
                        <button onClick={() => cancel(r.id)} className="p-1 rounded hover:bg-[#FEE2E2] text-[#B91C1C]"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(r)} className="p-1 rounded hover:bg-[#F1F5F9]"><Edit3 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`.input { padding: 6px 8px; border: 1px solid #CBD5E0; border-radius: 6px; background: #fff; font-size: 13px; }`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-[#475569] mb-1">{label}</div>
      {children}
    </label>
  );
}

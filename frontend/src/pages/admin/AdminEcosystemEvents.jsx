import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Calendar as CalIcon } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const EVENT_TYPES = ["RUG", "Conference", "Webinar"];

const EMPTY = {
  title: "",
  event_type: "RUG",
  date: "",
  time: "",
  timezone: "",
  sponsor: "",
  location: "",
  register_url: "",
  is_published: true,
};

export default function AdminEcosystemEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, "new" = create, evt_id = edit
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ecosystem/events");
      setEvents(data.items || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit   = (ev) => { setForm({ ...EMPTY, ...ev }); setEditing(ev.id); };
  const closeForm  = () => { setEditing(null); setForm(EMPTY); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/admin/ecosystem/events", form);
        toast.success("Event created");
      } else {
        await api.patch(`/admin/ecosystem/events/${editing}`, form);
        toast.success("Event updated");
      }
      closeForm();
      refresh();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/ecosystem/events/${ev.id}`);
      toast.success("Event deleted");
      refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const upcoming = useMemo(() => events.filter((e) => !e.date || e.date >= new Date().toISOString().slice(0,10)), [events]);
  const past     = useMemo(() => events.filter((e) =>  e.date && e.date <  new Date().toISOString().slice(0,10)), [events]);

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Ecosystem events</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage events shown on the public <strong>/ecosystem</strong> page.</p>
        </div>
        <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium"
                data-testid="event-create-btn">
          <Plus className="w-4 h-4" /> New event
        </button>
      </div>

      {/* Form (modal-style inline panel) */}
      {editing && (
        <form onSubmit={save}
              className="bg-white border border-[#0D9373]/30 rounded-lg p-5 mb-6 shadow-sm"
              data-testid="event-form">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-semibold text-[#0A1628]">
              {editing === "new" ? "New event" : "Edit event"}
            </h2>
            <button type="button" onClick={closeForm} className="text-[#94A3B8] hover:text-[#0A1628]" data-testid="event-form-close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Title *">
              <input required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}
                     className={inputCls} data-testid="event-form-title" />
            </Field>
            <Field label="Event type *">
              <select value={form.event_type} onChange={(e)=>setForm({...form,event_type:e.target.value})}
                      className={inputCls} data-testid="event-form-type">
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date * (YYYY-MM-DD)">
              <input required type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}
                     className={inputCls} data-testid="event-form-date" />
            </Field>
            <Field label="Time (e.g. 4:00 PM – 7:00 PM)">
              <input value={form.time} onChange={(e)=>setForm({...form,time:e.target.value})}
                     className={inputCls} data-testid="event-form-time" />
            </Field>
            <Field label="Timezone (e.g. MT, CT, UTC)">
              <input value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}
                     className={inputCls} data-testid="event-form-tz" />
            </Field>
            <Field label="Sponsor / Host">
              <input value={form.sponsor} onChange={(e)=>setForm({...form,sponsor:e.target.value})}
                     className={inputCls} data-testid="event-form-sponsor" />
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}
                     className={inputCls} data-testid="event-form-location" />
            </Field>
            <Field label="Register URL">
              <input type="url" placeholder="https://…" value={form.register_url}
                     onChange={(e)=>setForm({...form,register_url:e.target.value})}
                     className={inputCls} data-testid="event-form-url" />
            </Field>
            <Field label="Published" wide>
              <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
                <input type="checkbox" checked={form.is_published}
                       onChange={(e)=>setForm({...form,is_published:e.target.checked})}
                       data-testid="event-form-published" />
                Visible on the public /ecosystem page
              </label>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeForm}
                    className="px-4 py-2 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium disabled:opacity-60"
                    data-testid="event-form-submit">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : (editing === "new" ? "Create event" : "Save changes")}
            </button>
          </div>
        </form>
      )}

      <EventTable label="Upcoming" rows={upcoming} loading={loading} onEdit={openEdit} onDelete={removeEvent} testid="events-upcoming" />
      <EventTable label="Past"     rows={past}     loading={false}  onEdit={openEdit} onDelete={removeEvent} testid="events-past" />
    </AdminLayout>
  );
}

const inputCls = "w-full px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9373]/30 focus:border-[#0D9373] bg-white";

function Field({ label, wide, children }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function EventTable({ label, rows, loading, onEdit, onDelete, testid }) {
  return (
    <section className="mb-8" data-testid={testid}>
      <h2 className="font-heading text-base font-semibold text-[#0A1628] mb-3">
        {label} <span className="text-[#94A3B8] font-normal">({rows.length})</span>
      </h2>
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#64748B]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-[#94A3B8] flex items-center gap-2"><CalIcon className="w-4 h-4" /> No events.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Title</th>
                <th className="px-4 py-2.5 font-semibold">Sponsor</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`event-row-${ev.id}`}>
                  <td className="px-4 py-3 text-[#0A1628] font-medium whitespace-nowrap">{ev.date}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-[#0D9373] uppercase tracking-wider">{ev.event_type}</span></td>
                  <td className="px-4 py-3 text-[#0A1628]">{ev.title}</td>
                  <td className="px-4 py-3 text-[#64748B]">{ev.sponsor || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      ev.is_published ? "bg-[#E1F5EE] text-[#0A7B59]" : "bg-[#F1F5F9] text-[#94A3B8]"
                    }`}>
                      {ev.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={()=>onEdit(ev)} className="p-1.5 rounded hover:bg-[#E2E8F0]" title="Edit" data-testid={`event-edit-${ev.id}`}>
                        <Pencil className="w-3.5 h-3.5 text-[#475569]" />
                      </button>
                      <button onClick={()=>onDelete(ev)} className="p-1.5 rounded hover:bg-[#FEE2E2]" title="Delete" data-testid={`event-delete-${ev.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

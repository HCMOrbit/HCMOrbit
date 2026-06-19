import React, { useEffect, useState } from "react";
import { Plus, Calendar as CalIcon } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { ecoInputCls, EcoFormField, EcoFormShell, EcoRowActions, EcoStatusPill } from "../../components/admin/EcoPrimitives";

const EVENT_TYPES = ["RUG", "Conference", "Webinar"];
const EMPTY = { title: "", event_type: "RUG", date: "", time: "", timezone: "", sponsor: "", location: "", register_url: "", is_published: true };

export default function EventsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { const { data } = await api.get("/admin/ecosystem/events"); setEvents(data.items || []); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit   = (ev) => { setForm({ ...EMPTY, ...ev }); setEditing(ev.id); };
  const closeForm  = () => { setEditing(null); setForm(EMPTY); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") { await api.post("/admin/ecosystem/events", form); toast.success("Event created"); }
      else { await api.patch(`/admin/ecosystem/events/${editing}`, form); toast.success("Event updated"); }
      closeForm(); refresh();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const removeEvent = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/ecosystem/events/${ev.id}`); toast.success("Event deleted"); refresh(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const today = new Date().toISOString().slice(0,10);
  const upcoming = events.filter((e) => !e.date || e.date >= today);
  const past     = events.filter((e) =>  e.date && e.date <  today);

  return (
    <>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <p className="text-sm text-[#64748B]">Events shown on the public <strong>/ecosystem</strong> page.</p>
        <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium"
                data-testid="event-create-btn">
          <Plus className="w-4 h-4" /> New event
        </button>
      </div>

      {editing && (
        <EcoFormShell
          title={editing === "new" ? "New event" : "Edit event"}
          onClose={closeForm} onSubmit={save} saving={saving}
          submitLabel={editing === "new" ? "Create event" : "Save changes"} testIdPrefix="event"
        >
          <EcoFormField label="Title *">
            <input required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className={ecoInputCls} data-testid="event-form-title" />
          </EcoFormField>
          <EcoFormField label="Event type *">
            <select value={form.event_type} onChange={(e)=>setForm({...form,event_type:e.target.value})} className={ecoInputCls} data-testid="event-form-type">
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </EcoFormField>
          <EcoFormField label="Date * (YYYY-MM-DD)">
            <input required type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} className={ecoInputCls} data-testid="event-form-date" />
          </EcoFormField>
          <EcoFormField label="Time">
            <input value={form.time} onChange={(e)=>setForm({...form,time:e.target.value})} className={ecoInputCls} data-testid="event-form-time" placeholder="4:00 PM – 7:00 PM" />
          </EcoFormField>
          <EcoFormField label="Timezone">
            <input value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})} className={ecoInputCls} data-testid="event-form-tz" placeholder="MT, CT, UTC…" />
          </EcoFormField>
          <EcoFormField label="Sponsor / Host">
            <input value={form.sponsor} onChange={(e)=>setForm({...form,sponsor:e.target.value})} className={ecoInputCls} data-testid="event-form-sponsor" />
          </EcoFormField>
          <EcoFormField label="Location">
            <input value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})} className={ecoInputCls} data-testid="event-form-location" />
          </EcoFormField>
          <EcoFormField label="Register URL">
            <input type="url" placeholder="https://…" value={form.register_url} onChange={(e)=>setForm({...form,register_url:e.target.value})} className={ecoInputCls} data-testid="event-form-url" />
          </EcoFormField>
          <EcoFormField label="Published" wide>
            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
              <input type="checkbox" checked={form.is_published} onChange={(e)=>setForm({...form,is_published:e.target.checked})} data-testid="event-form-published" />
              Visible on the public /ecosystem page
            </label>
          </EcoFormField>
        </EcoFormShell>
      )}

      <EventTable label="Upcoming" rows={upcoming} loading={loading}  onEdit={openEdit} onDelete={removeEvent} testid="events-upcoming" />
      <EventTable label="Past"     rows={past}     loading={false}    onEdit={openEdit} onDelete={removeEvent} testid="events-past" />
    </>
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
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Type</th>
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Sponsor</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold w-32 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`event-row-${ev.id}`}>
                  <td className="px-4 py-3 text-[#0A1628] font-medium whitespace-nowrap">{ev.date}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-[#0D9373] uppercase tracking-wider">{ev.event_type}</span></td>
                  <td className="px-4 py-3 text-[#0A1628]">{ev.title}</td>
                  <td className="px-4 py-3 text-[#64748B]">{ev.sponsor || "—"}</td>
                  <td className="px-4 py-3"><EcoStatusPill isPublished={ev.is_published} /></td>
                  <td className="px-4 py-3 text-right">
                    <EcoRowActions testIdPrefix="event" id={ev.id} onEdit={()=>onEdit(ev)} onDelete={()=>onDelete(ev)} />
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

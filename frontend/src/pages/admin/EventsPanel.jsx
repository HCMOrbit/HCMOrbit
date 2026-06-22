import React, { useEffect, useState } from "react";
import { Plus, Calendar as CalIcon, Link2, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { ecoInputCls, EcoFormField, EcoFormShell, EcoRowActions, EcoStatusPill } from "../../components/admin/EcoPrimitives";

const EVENT_TYPES = ["RUG", "Conference", "Webinar"];
const EMPTY = {
  title: "", event_type: "RUG", date: "", time: "", timezone: "",
  sponsor: "", location: "", register_url: "", description: "", is_published: true,
  is_recurring: false, recurrence_rule: "monthly", recurrence_end: "",
  series_url: "", is_on_demand: false,
};

export default function EventsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, setFetching] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { const { data } = await api.get("/admin/ecosystem/events"); setEvents(data.items || []); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setForm(EMPTY); setFetchUrl(""); setEditing("new"); };
  const openEdit   = (ev) => { setForm({ ...EMPTY, ...ev }); setFetchUrl(""); setEditing(ev.id); };
  const closeForm  = () => { setEditing(null); setForm(EMPTY); setFetchUrl(""); };

  // Best-effort URL → form pre-fill. Toast on full miss; keep manual entry path open.
  const fetchFromUrl = async () => {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    try {
      const { data } = await api.post("/admin/ecosystem/events/fetch-url", { url: fetchUrl.trim() });
      // Source === "unknown" means the scraper got nothing meaningful.
      const hit = data?.source && data.source !== "unknown" && (data.title || data.date);
      if (!hit) {
        toast.error("Could not auto-fill — please fill in manually.");
        setForm((f) => ({ ...f, register_url: data?.register_url || fetchUrl.trim() }));
        return;
      }
      setForm((f) => ({
        ...f,
        title:        data.title       ?? f.title,
        event_type:   data.event_type  ?? f.event_type,
        date:         data.date        ?? f.date,
        time:         data.time        ?? f.time,
        sponsor:      data.sponsor     ?? f.sponsor,
        location:     data.location    ?? f.location,
        description:  data.description ?? f.description,
        register_url: data.register_url ?? fetchUrl.trim(),
      }));
      toast.success(`Auto-filled from ${data.source === "jsonld" ? "structured data" : "page metadata"}.`);
    } catch (e) {
      toast.error("Could not auto-fill — please fill in manually.");
    } finally {
      setFetching(false);
    }
  };

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

  // One-click publish for scraped drafts.
  const publishOne = async (ev) => {
    try {
      await api.patch(`/admin/ecosystem/events/${ev.id}`, { is_published: true });
      toast.success(`Published "${ev.title}"`);
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // On-demand WDBeacon scrape — feeds `Scraped (pending review)` below.
  const [scrapingRugs, setScrapingRugs] = useState(false);
  const scrapeRugs = async () => {
    setScrapingRugs(true);
    try {
      const { data } = await api.post("/admin/ecosystem/scrape-rugs");
      if (data.found === 0) {
        toast.info("WDBeacon scrape complete — 0 events found (site may be behind CAPTCHA).");
      } else {
        toast.success(`WDBeacon scrape complete — ${data.new} new, ${data.updated} updated.`);
      }
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setScrapingRugs(false);
    }
  };

  // On-demand Meetup scrape (Workday + HCM keywords).
  const [scrapingMeetup, setScrapingMeetup] = useState(false);
  const scrapeMeetup = async () => {
    setScrapingMeetup(true);
    try {
      const { data } = await api.post("/admin/ecosystem/scrape-meetup");
      if (data.found === 0) {
        toast.info("Meetup scrape complete — 0 Workday-relevant events found.");
      } else {
        toast.success(`Meetup scrape complete — ${data.new} new, ${data.updated} updated.`);
      }
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setScrapingMeetup(false);
    }
  };

  // On-demand Eventbrite RUG scrape (curated organizer pages).
  const [scrapingEventbrite, setScrapingEventbrite] = useState(false);
  const scrapeEventbrite = async () => {
    setScrapingEventbrite(true);
    try {
      const { data } = await api.post("/admin/ecosystem/scrape-eventbrite");
      if (data.found === 0) {
        toast.info("Eventbrite scrape complete — 0 upcoming RUG events found.");
      } else {
        toast.success(`Eventbrite scrape complete — ${data.new} new, ${data.updated} updated.`);
      }
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setScrapingEventbrite(false);
    }
  };

  // Fan-out scrape across all 3 sources, single merged toast.
  const [scrapingAll, setScrapingAll] = useState(false);
  const scrapeAllSources = async () => {
    setScrapingAll(true);
    try {
      const endpoints = [
        "/admin/ecosystem/scrape-rugs",
        "/admin/ecosystem/scrape-meetup",
        "/admin/ecosystem/scrape-eventbrite",
      ];
      const results = await Promise.all(
        endpoints.map((url) => api.post(url).then((r) => r.data).catch(() => null))
      );
      const totals = results.reduce(
        (acc, r) => r ? {
          new: acc.new + (r.new || 0),
          updated: acc.updated + (r.updated || 0),
          found: acc.found + (r.found || 0),
        } : acc,
        { new: 0, updated: 0, found: 0 },
      );
      const failures = results.filter((r) => r === null).length;
      if (totals.new + totals.updated === 0) {
        toast.info(`Scraped all sources — 0 new events found${failures ? ` (${failures} source${failures > 1 ? "s" : ""} failed)` : ""}.`);
      } else {
        toast.success(
          `Scraped all sources — ${totals.new} new, ${totals.updated} updated` +
          (failures ? ` (${failures} source${failures > 1 ? "s" : ""} failed)` : "")
        );
      }
      refresh();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setScrapingAll(false);
    }
  };

  const SCRAPER_SOURCES = new Set(["wdbeacon", "meetup", "eventbrite", "community"]);
  const scrapedPending = events.filter((e) => SCRAPER_SOURCES.has(e.source) && !e.is_published);
  const scrapedIds = new Set(scrapedPending.map((e) => e.id));
  // Backend annotates each event with `is_past` (handles recurring + on-demand).
  // Fall back to date comparison only for legacy rows that haven't been re-fetched yet.
  const today = new Date().toISOString().slice(0, 10);
  const isPastFallback = (e) => e.date && e.date < today && !e.is_on_demand && !e.is_recurring;
  const isPast = (e) => (e.is_past !== undefined ? e.is_past : isPastFallback(e));
  const upcoming = events.filter((e) => !scrapedIds.has(e.id) && !isPast(e));
  const past     = events.filter((e) => !scrapedIds.has(e.id) &&  isPast(e));

  return (
    <>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <p className="text-sm text-[#64748B]">Events shown on the public <strong>/ecosystem</strong> page.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={scrapeAllSources} disabled={scrapingAll}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold disabled:opacity-50"
                  data-testid="event-scrape-all-btn">
            {scrapingAll ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping all…</> : <><RefreshCw className="w-4 h-4" /> Scrape all sources</>}
          </button>
          <button onClick={scrapeRugs} disabled={scrapingRugs}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-medium disabled:opacity-50"
                  data-testid="event-scrape-rugs-btn">
            {scrapingRugs ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping…</> : <><RefreshCw className="w-4 h-4" /> Scrape RUGs now</>}
          </button>
          <button onClick={scrapeMeetup} disabled={scrapingMeetup}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-medium disabled:opacity-50"
                  data-testid="event-scrape-meetup-btn">
            {scrapingMeetup ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping…</> : <><RefreshCw className="w-4 h-4" /> Scrape Meetup now</>}
          </button>
          <button onClick={scrapeEventbrite} disabled={scrapingEventbrite}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-medium disabled:opacity-50"
                  data-testid="event-scrape-eventbrite-btn">
            {scrapingEventbrite ? <><Loader2 className="w-4 h-4 animate-spin" /> Scraping…</> : <><RefreshCw className="w-4 h-4" /> Scrape Eventbrite</>}
          </button>
          <button onClick={openCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium"
                  data-testid="event-create-btn">
            <Plus className="w-4 h-4" /> New event
          </button>
        </div>
      </div>

      {editing && (
        <EcoFormShell
          title={editing === "new" ? "New event" : "Edit event"}
          onClose={closeForm} onSubmit={save} saving={saving}
          submitLabel={editing === "new" ? "Create event" : "Save changes"} testIdPrefix="event"
        >
          <EcoFormField label="Paste event URL (auto-fill)" wide>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="url"
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="https://www.eventbrite.com/e/…  or  https://workday.com/…/event"
                  className={`${ecoInputCls} pl-9`}
                  data-testid="event-form-fetch-url"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchFromUrl(); } }}
                />
              </div>
              <button
                type="button"
                onClick={fetchFromUrl}
                disabled={fetching || !fetchUrl.trim()}
                data-testid="event-form-fetch-btn"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetching ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <>Fetch details</>}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[#94A3B8] leading-snug">
              Works best with Eventbrite. Falls back to OpenGraph for any page. Review and correct the fields below before saving.
            </p>
          </EcoFormField>

          <EcoFormField label="Title *">
            <input required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className={ecoInputCls} data-testid="event-form-title" />
          </EcoFormField>
          <EcoFormField label="Event type *">
            <select
              value={form.event_type}
              onChange={(e) => {
                const t = e.target.value;
                // When the user picks Webinar for the first time, default to
                // "On demand" since most webinars are recorded. They can flip
                // it off in the next field for a live, dated webinar.
                setForm((f) => ({
                  ...f,
                  event_type: t,
                  is_on_demand: t === "Webinar" && !f.is_recurring ? true : f.is_on_demand,
                }));
              }}
              className={ecoInputCls}
              data-testid="event-form-type"
            >
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </EcoFormField>

          <EcoFormField label={form.is_on_demand ? "Date (disabled — on-demand)" : "Date *"}>
            <input
              type="date"
              required={!form.is_on_demand}
              disabled={form.is_on_demand}
              value={form.is_on_demand ? "" : form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={`${ecoInputCls} ${form.is_on_demand ? "opacity-50 cursor-not-allowed" : ""}`}
              data-testid="event-form-date"
            />
          </EcoFormField>

          {/* Recurring + On-demand controls — mutually exclusive */}
          <EcoFormField label="Recurring">
            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm({
                  ...form,
                  is_recurring: e.target.checked,
                  // mutually exclusive with on-demand
                  is_on_demand: e.target.checked ? false : form.is_on_demand,
                })}
                data-testid="event-form-recurring"
              />
              This event repeats on a schedule
            </label>
            {form.is_recurring && (
              <div className="mt-3 grid grid-cols-2 gap-3" data-testid="event-form-recurring-details">
                <select
                  value={form.recurrence_rule || "monthly"}
                  onChange={(e) => setForm({ ...form, recurrence_rule: e.target.value })}
                  className={ecoInputCls}
                  data-testid="event-form-recurrence-rule"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly (same day-of-month)</option>
                  <option value="monthly_nth_weekday">Monthly (same Nth weekday)</option>
                </select>
                <input
                  type="date"
                  placeholder="End date (optional)"
                  value={form.recurrence_end || ""}
                  onChange={(e) => setForm({ ...form, recurrence_end: e.target.value })}
                  className={ecoInputCls}
                  data-testid="event-form-recurrence-end"
                />
              </div>
            )}
          </EcoFormField>

          <EcoFormField label="On demand">
            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
              <input
                type="checkbox"
                checked={form.is_on_demand}
                onChange={(e) => setForm({
                  ...form,
                  is_on_demand: e.target.checked,
                  // mutually exclusive with recurring; also clear date when going on-demand
                  is_recurring: e.target.checked ? false : form.is_recurring,
                  date: e.target.checked ? "" : form.date,
                })}
                data-testid="event-form-on-demand"
              />
              No fixed date — recorded/on-demand (e.g. evergreen webinar)
            </label>
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
          <EcoFormField label="Description" wide>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short blurb about the event — shown as a preview on the event card and in full on /ecosystem/events."
              className={`${ecoInputCls} resize-y leading-relaxed`}
              data-testid="event-form-description"
            />
          </EcoFormField>
          <EcoFormField label="Published" wide>
            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
              <input type="checkbox" checked={form.is_published} onChange={(e)=>setForm({...form,is_published:e.target.checked})} data-testid="event-form-published" />
              Visible on the public /ecosystem page
            </label>
          </EcoFormField>
        </EcoFormShell>
      )}

      <EventTable
        label="Scraped (pending review)"
        rows={scrapedPending}
        loading={loading}
        onEdit={openEdit}
        onDelete={removeEvent}
        onPublish={publishOne}
        emptyHint="No pending submissions or scraped drafts. Use the scraper buttons above to pull events, or wait for community submissions."
        testid="events-scraped"
        showSource
      />
      <EventTable label="Upcoming" rows={upcoming} loading={loading}  onEdit={openEdit} onDelete={removeEvent} testid="events-upcoming" />
      <EventTable label="Past"     rows={past}     loading={false}    onEdit={openEdit} onDelete={removeEvent} testid="events-past" />
    </>
  );
}

function EventTable({ label, rows, loading, onEdit, onDelete, onPublish, testid, showSource, emptyHint }) {
  return (
    <section className="mb-8" data-testid={testid}>
      <h2 className="font-heading text-base font-semibold text-[#0A1628] mb-3">
        {label} <span className="text-[#94A3B8] font-normal">({rows.length})</span>
      </h2>
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#64748B]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-[#94A3B8] flex items-center gap-2"><CalIcon className="w-4 h-4" /> {emptyHint || "No events."}</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Type</th>
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Sponsor</th>
              {showSource && <th className="px-4 py-2.5 font-semibold">Source</th>}
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold w-44 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`event-row-${ev.id}`}>
                  <td className="px-4 py-3 text-[#0A1628] font-medium whitespace-nowrap">
                    {ev.is_on_demand
                      ? <span data-testid={`event-row-${ev.id}-on-demand`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#E0F2FE] text-[#075985] text-[11px] font-semibold uppercase tracking-wider border border-[#7DD3FC]">On demand</span>
                      : ev.is_recurring
                      ? <span data-testid={`event-row-${ev.id}-recurring`} className="inline-flex items-center gap-1 text-[#0A1628]">
                          {ev.next_date || ev.date}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#F3E8FF] text-[#7E22CE] text-[10px] font-semibold uppercase tracking-wider border border-[#D8B4FE]">
                            {ev.recurrence_rule === "weekly" ? "Weekly" : "Monthly"}
                          </span>
                        </span>
                      : (ev.date || "—")
                    }
                  </td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-[#0D9373] uppercase tracking-wider">{ev.event_type}</span></td>
                  <td className="px-4 py-3 text-[#0A1628]">{ev.title}</td>
                  <td className="px-4 py-3 text-[#64748B]">{ev.sponsor || "—"}</td>
                  {showSource && (
                    <td className="px-4 py-3" data-testid={`event-source-${ev.id}`}>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          ev.source === "community"
                            ? "bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]"
                            : ev.source === "eventbrite"
                            ? "bg-[#FFEDD5] text-[#C2410C] border border-[#FDBA74]"
                            : ev.source === "meetup"
                            ? "bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]"
                            : "bg-[#FEF3C7] text-[#92400E]"
                        }`}
                      >
                        {ev.source || "manual"}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3"><EcoStatusPill isPublished={ev.is_published} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {onPublish && !ev.is_published && (
                        <button
                          onClick={() => onPublish(ev)}
                          data-testid={`event-publish-${ev.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#0D9373] hover:bg-[#0b7c61] text-white"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Publish
                        </button>
                      )}
                      <EcoRowActions testIdPrefix="event" id={ev.id} onEdit={()=>onEdit(ev)} onDelete={()=>onDelete(ev)} />
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

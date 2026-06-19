import React, { useState } from "react";
import { X, Link2, Loader2, Send, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const EVENT_TYPES = ["RUG", "Conference", "Webinar"];
const EMPTY = {
  title: "", event_type: "RUG", date: "", time: "", timezone: "",
  sponsor: "", location: "", register_url: "", description: "",
};

const inputCls =
  "w-full rounded-md border border-[#E2E8F0] bg-white text-[#0A1628] text-sm px-3 py-2 focus:outline-none focus:border-[#0D9373] focus:ring-1 focus:ring-[#0D9373]/30";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider font-semibold text-[#475569] mb-1">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * SubmitEventModal — community-facing event submission.
 *
 * Posts to the public `POST /api/ecosystem/events/submit`. Always stored as a
 * draft with `source='community'`; admins review/publish in /admin/ecosystem.
 * Includes the same URL auto-fill helper used by the admin form.
 */
export default function SubmitEventModal({ onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchFromUrl = async () => {
    if (!fetchUrl.trim()) return;
    setFetching(true);
    try {
      const { data } = await api.post("/ecosystem/events/fetch-url", { url: fetchUrl.trim() });
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

  const submit = async (e) => {
    e.preventDefault();
    // Client-side guard mirrors backend required fields.
    if (!form.title.trim())        return toast.error("Event name is required");
    if (!form.date.trim())         return toast.error("Date is required");
    if (!form.location.trim())     return toast.error("Location is required");
    if (!form.sponsor.trim())      return toast.error("Organizer/sponsor is required");
    if (!form.register_url.trim()) return toast.error("Registration URL is required");
    if (!form.time.trim())         return toast.error("Time is required");
    setSubmitting(true);
    try {
      await api.post("/ecosystem/events/submit", form);
      setDone(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" data-testid="submit-event-modal">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-heading font-semibold text-lg text-[#0A1628]">Submit a community event</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#F1F5F9]" data-testid="submit-event-close" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          // ── Thank-you state ────────────────────────────────────────────────
          <div className="p-10 text-center" data-testid="submit-event-success">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
            </div>
            <h4 className="font-heading text-lg font-semibold text-[#0A1628] mb-2">
              Thanks for submitting!
            </h4>
            <p className="text-sm text-[#64748B] mb-6 max-w-md mx-auto">
              We&apos;ll review and publish it shortly. Keep an eye on{" "}
              <span className="font-medium text-[#0A1628]">/ecosystem/events</span> for it to appear.
            </p>
            <button
              onClick={onClose}
              data-testid="submit-event-done"
              className="px-5 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          // ── Form state ──────────────────────────────────────────────────────
          <form onSubmit={submit} className="p-6 flex flex-col gap-4" data-testid="submit-event-form">
            {/* URL auto-fill */}
            <div>
              <span className="block text-[11px] uppercase tracking-wider font-semibold text-[#475569] mb-1">
                Paste event URL (auto-fill)
              </span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type="url"
                    value={fetchUrl}
                    onChange={(e) => setFetchUrl(e.target.value)}
                    placeholder="https://www.eventbrite.com/e/… or any event page"
                    className={`${inputCls} pl-9`}
                    data-testid="submit-event-fetch-url"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchFromUrl(); } }}
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchFromUrl}
                  disabled={fetching || !fetchUrl.trim()}
                  data-testid="submit-event-fetch-btn"
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetching ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : "Fetch details"}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8] leading-snug">
                Works best with Eventbrite. Falls back to OpenGraph for any page. Review and correct below before submitting.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Event name" required>
                  <input
                    type="text" value={form.title} onChange={(e) => setField("title", e.target.value)}
                    className={inputCls} data-testid="submit-event-title" required
                  />
                </Field>
              </div>

              <Field label="Event type" required>
                <select
                  value={form.event_type} onChange={(e) => setField("event_type", e.target.value)}
                  className={inputCls} data-testid="submit-event-type"
                >
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Date (YYYY-MM-DD)" required>
                <input
                  type="date" value={form.date} onChange={(e) => setField("date", e.target.value)}
                  className={inputCls} data-testid="submit-event-date" required
                />
              </Field>

              <Field label="Time" required>
                <input
                  type="text" value={form.time} onChange={(e) => setField("time", e.target.value)}
                  placeholder="e.g. 4:00–7:00 PM"
                  className={inputCls} data-testid="submit-event-time" required
                />
              </Field>

              <Field label="Timezone">
                <input
                  type="text" value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                  placeholder="MT, CT, ET, UTC…"
                  className={inputCls} data-testid="submit-event-timezone"
                />
              </Field>

              <Field label="Location" required>
                <input
                  type="text" value={form.location} onChange={(e) => setField("location", e.target.value)}
                  placeholder="City, venue, or 'Online'"
                  className={inputCls} data-testid="submit-event-location" required
                />
              </Field>

              <Field label="Organizer / Sponsor" required>
                <input
                  type="text" value={form.sponsor} onChange={(e) => setField("sponsor", e.target.value)}
                  placeholder="Who is hosting?"
                  className={inputCls} data-testid="submit-event-sponsor" required
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Registration URL" required>
                  <input
                    type="url" value={form.register_url} onChange={(e) => setField("register_url", e.target.value)}
                    placeholder="https://…"
                    className={inputCls} data-testid="submit-event-url" required
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Description (optional)">
                  <textarea
                    rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)}
                    placeholder="Short blurb describing the event."
                    className={`${inputCls} resize-y leading-relaxed`}
                    data-testid="submit-event-description"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button" onClick={onClose}
                data-testid="submit-event-cancel"
                className="px-4 py-2 rounded text-sm border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={submitting}
                data-testid="submit-event-submit"
                className="px-5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit event</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

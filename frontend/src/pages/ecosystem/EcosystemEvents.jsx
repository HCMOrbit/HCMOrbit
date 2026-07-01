import React, { useEffect, useMemo, useState } from "react";
import { Calendar, X, Plus, MapPin, ExternalLink, Repeat } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import SubmitEventModal from "./SubmitEventModal";
import { api } from "../../lib/api";

// ── Filter helpers ─────────────────────────────────────────────────────────

const EVENT_TYPES = ["RUG", "Conference", "Webinar"];

/** Build current month + next 3 months, sample shape: { value: "2026-06", label: "Jun 2026" } */
function buildMonthOptions(now = new Date()) {
  const fmt = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: fmt.format(d) };
  });
}

/** Parse `ev.date` (ISO "2026-06-17" or combined "June 17, 2026 · 4:00 PM…") → "YYYY-MM" or null. */
function eventMonthKey(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const head = dateStr.split("·")[0].trim();
  // YYYY-MM-DD: read the month directly from the string. Don't construct a
  // Date — `new Date("2026-06-30")` is UTC midnight and resolves to a
  // different month in some timezones, mis-bucketing the event.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(head);
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date(head);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Tolerate both API (`event_type`) and placeholder (`category`) shapes. */
function eventType(ev) {
  return ev.event_type || ev.category || null;
}

// ── Compact event tile ─────────────────────────────────────────────────────

const TYPE_TINT = {
  RUG:        { bg: "#0D9373", label: "RUG" },
  Conference: { bg: "#F59E0B", label: "Conference" },
  Webinar:    { bg: "#3B82F6", label: "Webinar" },
  DEFAULT:    { bg: "#475569", label: "Event" },
};

function parseLocalYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function formatEventDate(ev) {
  if (ev.is_on_demand) return "On demand";
  const raw = ev.next_date || ev.date || "";
  if (!raw) return "TBD";
  if (raw.includes("·")) return raw; // pre-formatted placeholder shape
  const d = parseLocalYmd(raw) || new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const base = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return ev.time ? `${base} · ${ev.time}` : base;
}

function EventTile({ ev }) {
  const type = eventType(ev) || "DEFAULT";
  const tint = TYPE_TINT[type] || TYPE_TINT.DEFAULT;
  const url = ev.url || ev.register_url || "#";
  const hasExternalUrl = url && url !== "#";
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!ev.image_url && !imgFailed;
  const dateLine = formatEventDate(ev);
  const locationLine = ev.is_on_demand
    ? "Anytime"
    : (ev.location || (ev.virtual ? "Virtual" : ""));

  return (
    <a
      href={url}
      target={hasExternalUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="group bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-[#0D9373]/40 transition-all duration-200"
      data-testid={`event-tile-${ev.id}`}
    >
      {/* Image / banner — 150px, cover, rounded via card overflow-hidden */}
      <div
        className="h-[150px] relative overflow-hidden flex items-center justify-center"
        style={{ background: tint.bg }}
      >
        {showImage ? (
          <img
            src={ev.image_url}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Calendar className="w-10 h-10 text-white/85" strokeWidth={1.5} />
        )}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-[11px] font-semibold text-[#0A1628]">
          {tint.label}
        </div>
        {ev.is_recurring && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-[11px] font-semibold text-[#475569]">
            <Repeat className="w-3 h-3" /> Recurring
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="font-heading text-[15px] font-semibold text-[#0A1628] leading-snug line-clamp-2 group-hover:text-[#0D9373] transition-colors">
          {ev.title || "(untitled event)"}
        </h3>
        <div className="text-xs text-[#475569] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{dateLine}</span>
        </div>
        {locationLine && (
          <div className="text-xs text-[#475569] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{locationLine}</span>
          </div>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="truncate">{ev.host || ev.sponsor || ""}</span>
          {hasExternalUrl && (
            <span className="inline-flex items-center gap-1 text-[#0D9373] font-semibold flex-shrink-0">
              Details <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active ? "true" : "false"}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? "bg-[#0A1628] text-white border-[#0A1628]"
          : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#0D9373] hover:text-[#0D9373]"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, options, value, onChange, testIdPrefix }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`${testIdPrefix}-group`}>
      <span className="text-xs uppercase tracking-wider font-semibold text-[#64748B] mr-1">
        {label}
      </span>
      <FilterChip
        active={value === "all"}
        onClick={() => onChange("all")}
        testId={`${testIdPrefix}-all`}
      >
        All
      </FilterChip>
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const l = typeof opt === "string" ? opt : opt.label;
        return (
          <FilterChip
            key={v}
            active={value === v}
            onClick={() => onChange(v)}
            testId={`${testIdPrefix}-${v}`}
          >
            {l}
          </FilterChip>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EcosystemEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/events")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled) setEvents(Array.isArray(items) ? items : []);
      })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (typeFilter !== "all" && eventType(ev) !== typeFilter) return false;
      // On-demand events bypass the month filter — they don't belong to a month.
      if (monthFilter !== "all") {
        if (ev.is_on_demand) return false;
        // For recurring events the backend's `next_date` already reflects the
        // upcoming occurrence; use it so the DMV-monthly forum shows up
        // under its actual next month, not the seed month.
        if (eventMonthKey(ev.next_date || ev.date) !== monthFilter) return false;
      }
      return true;
    });
  }, [events, typeFilter, monthFilter]);

  const filtersActive = typeFilter !== "all" || monthFilter !== "all";
  const clearFilters = () => { setTypeFilter("all"); setMonthFilter("all"); };

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-events-page">
      <NavHeader />
      <EcosystemSubpageHero
        eyebrow="UPCOMING EVENTS"
        title="Workday community events"
        description="RUGs, conferences, and webinars — every gathering across the Workday ecosystem in one place."
        current="Events"
      />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Top action bar — Submit-an-event lives here so it sits next to filters */}
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowSubmit(true)}
            data-testid="submit-event-open-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#F0FDF4] text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Submit an event
          </button>
        </div>

        {/* Filter bar */}
        {!loading && events.length > 0 && (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-4 lg:p-5 mb-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"
            data-testid="events-filter-bar"
          >
            <FilterGroup
              label="Type"
              options={EVENT_TYPES}
              value={typeFilter}
              onChange={setTypeFilter}
              testIdPrefix="events-filter-type"
            />
            <div className="hidden lg:block w-px h-6 bg-[#E2E8F0]" aria-hidden="true" />
            <FilterGroup
              label="Month"
              options={monthOptions}
              value={monthFilter}
              onChange={setMonthFilter}
              testIdPrefix="events-filter-month"
            />
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                data-testid="events-filter-clear"
                className="lg:ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0D9373] hover:text-[#0b7c61]"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">
              {filtersActive ? "Filtered events" : "All events"}
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-[#64748B]" data-testid="events-count">
              {filtered.length} {filtered.length === 1 ? "event" : "events"}
              {filtersActive && events.length !== filtered.length && (
                <span className="text-[#94A3B8]"> of {events.length}</span>
              )}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-[#64748B] py-12 text-center" data-testid="events-loading">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="events-empty"
          >
            <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B]">No upcoming events right now. Check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="events-filtered-empty"
          >
            <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B] mb-3">No events match the current filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              data-testid="events-filtered-empty-clear"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9373] hover:text-[#0b7c61]"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          </div>
        ) : (
          <div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="events-list"
          >
            {filtered.map((ev) => <EventTile key={ev.id} ev={ev} />)}
          </div>
        )}
      </main>
      {showSubmit && <SubmitEventModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

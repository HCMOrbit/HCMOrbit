import React, { useEffect, useMemo, useState } from "react";
import { Calendar, X, Plus } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import { EventCard } from "../Ecosystem";
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
  const d = new Date(head);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Tolerate both API (`event_type`) and placeholder (`category`) shapes. */
function eventType(ev) {
  return ev.event_type || ev.category || null;
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
      if (monthFilter !== "all" && eventMonthKey(ev.date) !== monthFilter) return false;
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
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            data-testid="events-list"
          >
            {filtered.map((ev) => <EventCard key={ev.id} ev={ev} expanded />)}
          </div>
        )}
      </main>
      {showSubmit && <SubmitEventModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

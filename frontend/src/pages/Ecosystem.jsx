import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarPlus,
  Newspaper,
  ClipboardList,
  ArrowRight,
  MapPin,
  Building2,
  Bot,
  Puzzle,
  Ticket,
  FileText,
} from "lucide-react";
import NavHeader from "../components/NavHeader";
import { api } from "../lib/api";

// ── Placeholder / fallback data ────────────────────────────────────────────

const PLACEHOLDER_EVENTS = [
  {
    id: "evt-denver-rug",
    category: "RUG",
    title: "Denver RUG",
    date: "June 17, 2026 · 4:00 – 7:00 PM MT",
    host: "Sponsored by Syssero",
    location: "Vail Resorts, Broomfield CO",
    url: "#",
  },
  {
    id: "evt-dallas-rug",
    category: "RUG",
    title: "Dallas RUG",
    date: "July 10, 2026 · 4:00 – 7:00 PM CT",
    host: "Hosted by Collaborative Solutions",
    location: "Location TBD",
    url: "#",
  },
  {
    id: "evt-rising-2026",
    category: "CONFERENCE",
    title: "Workday Rising 2026",
    date: "Sept 15 – 18, 2026",
    host: "Workday",
    location: "San Francisco, CA",
    url: "https://www.workday.com/en-us/company/events/rising.html",
  },
];

const PLACEHOLDER_NEWS = [
  { id: "n1", icon: "bot",    headline: "Workday AI agents — new capabilities",         date: "June 10, 2026", url: "#" },
  { id: "n2", icon: "puzzle", headline: "Workday Extend: new features released",        date: "June 9, 2026",  url: "#" },
  { id: "n3", icon: "ticket", headline: "Workday Rising 2026 early registration open",  date: "June 5, 2026",  url: "#" },
  { id: "n4", icon: "doc",    headline: "Workday Q2 release notes are live",            date: "June 2, 2026",  url: "#" },
];

const PLACEHOLDER_CERTS = [
  { id: "c1", name: "Workday Data Cloud certification",     tone: "teal",  statusLabel: "New" },
  { id: "c2", name: "Workday Financials Professional",      tone: "amber", statusLabel: "July 2026" },
  { id: "c3", name: "Workday Learning Center updates",      tone: "amber", statusLabel: "Upcoming" },
  { id: "c4", name: "HCM Core recertification path released", tone: "teal", statusLabel: "New" },
];

// ── Visual primitives ──────────────────────────────────────────────────────

const CATEGORY_GRADIENT = {
  RUG:        "linear-gradient(135deg, #134E4A 0%, #0D9373 55%, #0A1628 100%)",
  CONFERENCE: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 45%, #0A1628 100%)",
  WEBINAR:    "linear-gradient(135deg, #581C87 0%, #7E22CE 45%, #0A1628 100%)",
  DEFAULT:    "linear-gradient(135deg, #0D9373 0%, #134E4A 50%, #0A1628 100%)",
};

const CATEGORY_PILL_STYLES = {
  RUG:        { bg: "rgba(13, 147, 115, 0.16)",  color: "#5EEAD4", border: "rgba(94, 234, 212, 0.40)" },
  CONFERENCE: { bg: "rgba(59, 130, 246, 0.18)",  color: "#93C5FD", border: "rgba(147, 197, 253, 0.40)" },
  WEBINAR:    { bg: "rgba(168, 85, 247, 0.18)",  color: "#D8B4FE", border: "rgba(216, 180, 254, 0.40)" },
  DEFAULT:    { bg: "rgba(255, 255, 255, 0.10)", color: "#FFFFFF", border: "rgba(255, 255, 255, 0.25)" },
};

const NEWS_ICONS = { bot: Bot, puzzle: Puzzle, ticket: Ticket, doc: FileText };

function SectionHeader({ icon: Icon, title, viewAllHref = "#", dataTestId }) {
  const isInternal = viewAllHref && viewAllHref !== "#" && viewAllHref.startsWith("/");
  return (
    <div className="flex items-center justify-between mb-5" data-testid={dataTestId}>
      <div className="inline-flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
        <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">{title}</h2>
      </div>
      {isInternal ? (
        <Link
          to={viewAllHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9373] hover:text-[#0b7c61]"
          data-testid={`${dataTestId}-view-all`}
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <a
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9373] hover:text-[#0b7c61]"
          data-testid={`${dataTestId}-view-all`}
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

// ── Google Calendar deep-link helpers ──────────────────────────────────────

// Map common North American timezone abbreviations (incl. DST variants) to
// IANA zones — Google Calendar accepts IANA zone names via the `ctz` param.
const TZ_ABBREV_TO_IANA = {
  PT: "America/Los_Angeles", PST: "America/Los_Angeles", PDT: "America/Los_Angeles",
  MT: "America/Denver",      MST: "America/Denver",      MDT: "America/Denver",
  CT: "America/Chicago",     CST: "America/Chicago",     CDT: "America/Chicago",
  ET: "America/New_York",    EST: "America/New_York",    EDT: "America/New_York",
  UTC: "UTC", GMT: "Etc/GMT",
};

/** "2026-06-17" → "20260617" (Google Cal compact date). Returns null on parse failure. */
function compactDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** Parse "4:00 PM" / "16:00" → {h, m}. Returns null if unparseable. */
function parseClock(s) {
  if (!s) return null;
  const m = /(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i.exec(s.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3]?.toLowerCase();
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return { h, m: min };
}

/** Parse a time range like "4:00–7:00 PM" / "4:00 PM - 7:00 PM" → [{h,m},{h,m}] or null. */
function parseTimeRange(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(/[–—-]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const endAmPm = /\b(am|pm)\b/i.exec(parts[1])?.[1];
  // If start has no am/pm but end does, inherit it.
  const startWithAmPm = /\b(am|pm)\b/i.test(parts[0]) ? parts[0] : `${parts[0]} ${endAmPm || ""}`.trim();
  const start = parseClock(startWithAmPm);
  const end = parseClock(parts[1]);
  if (!start || !end) return null;
  return [start, end];
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Build a Google Calendar TEMPLATE URL for the given event. Falls back to an
 * all-day event when the time field is missing or unparseable. Returns null if
 * the event has no usable date.
 */
export function buildGoogleCalendarUrl(ev) {
  const dateCompact = compactDate(ev.date);
  if (!dateCompact) return null;

  const title = ev.title || "Workday community event";
  const location = ev.location || "";
  const host = ev.host || ev.sponsor;
  const detailsParts = [];
  if (host) detailsParts.push(`Host: ${host}`);
  const regUrl = ev.url || ev.register_url;
  if (regUrl && regUrl !== "#") detailsParts.push(`Register: ${regUrl}`);
  detailsParts.push("Shared via HCMOrbit");
  const details = detailsParts.join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
  });
  if (location) params.set("location", location);

  const range = parseTimeRange(ev.time);
  if (range) {
    const [s, e] = range;
    const startStr = `${dateCompact}T${pad(s.h)}${pad(s.m)}00`;
    const endStr   = `${dateCompact}T${pad(e.h)}${pad(e.m)}00`;
    params.set("dates", `${startStr}/${endStr}`);
    const iana = TZ_ABBREV_TO_IANA[(ev.timezone || "").toUpperCase().replace(/[^A-Z]/g, "")];
    if (iana) params.set("ctz", iana);
  } else {
    // All-day event: end date must be the day after start (exclusive).
    const y = parseInt(dateCompact.slice(0, 4), 10);
    const m = parseInt(dateCompact.slice(4, 6), 10);
    const d = parseInt(dateCompact.slice(6, 8), 10);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    const endCompact = `${nextDay.getUTCFullYear()}${pad(nextDay.getUTCMonth() + 1)}${pad(nextDay.getUTCDate())}`;
    params.set("dates", `${dateCompact}/${endCompact}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function EventCard({ ev }) {
  // Tolerate both shapes: placeholder ({category, date, host, location, url}) and
  // API ({event_type, date, time, timezone, sponsor, location, register_url}).
  const category = ev.category || ev.event_type || "DEFAULT";
  const categoryKey = category === "Conference" ? "CONFERENCE"
                    : category === "Webinar"    ? "WEBINAR"
                    : category;
  const pill = CATEGORY_PILL_STYLES[categoryKey] || CATEGORY_PILL_STYLES.DEFAULT;
  const gradient = CATEGORY_GRADIENT[categoryKey] || CATEGORY_GRADIENT.DEFAULT;
  const host = ev.host || ev.sponsor;
  const url = ev.url || ev.register_url || "#";
  const gcalUrl = buildGoogleCalendarUrl(ev);
  // Format date line: prefer combined placeholder string; otherwise build from API fields.
  let dateLine = ev.date || "";
  if (dateLine && !dateLine.includes("·")) {
    try {
      const d = new Date(dateLine);
      if (!Number.isNaN(d.getTime())) {
        dateLine = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
      }
    } catch { /* leave as-is */ }
    if (ev.time) dateLine += ` · ${ev.time}`;
    if (ev.timezone) dateLine += ` ${ev.timezone}`;
  }
  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      data-testid={`event-${ev.id}`}
    >
      {/* Gradient header with category pill anchored bottom-left */}
      <div className="h-[160px] relative" style={{ background: gradient }}>
        <span
          className="absolute left-5 bottom-5 inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border"
          style={{ background: pill.bg, color: pill.color, borderColor: pill.border }}
        >
          {category}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="font-heading text-lg font-semibold text-[#0A1628] leading-snug">{ev.title}</h3>
        <ul className="space-y-1.5 text-[13px] text-[#475569]">
          <li className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#0D9373] shrink-0 mt-0.5" />
            <span>{dateLine}</span>
          </li>
          {host && (
            <li className="flex items-start gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#0D9373] shrink-0 mt-0.5" />
              <span>{host}</span>
            </li>
          )}
          {ev.location && (
            <li className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#0D9373] shrink-0 mt-0.5" />
              <span>{ev.location}</span>
            </li>
          )}
        </ul>
        <a
          href={url}
          target={url && url !== "#" ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#0A1628] hover:border-[#0D9373] hover:text-[#0D9373] transition-colors"
          data-testid={`event-${ev.id}-register`}
        >
          Register now <ArrowRight className="w-3.5 h-3.5" />
        </a>
        {gcalUrl && (
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0D9373] transition-colors"
            data-testid={`event-${ev.id}-add-to-calendar`}
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Add to calendar
          </a>
        )}
      </div>
    </div>
  );
}

function formatNewsDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function NewsRow({ n, isLast }) {
  // Tolerate both shapes: placeholder ({icon, headline, date, url}) and API
  // ({title, url, published_at, summary, source}).
  const Icon = NEWS_ICONS[n.icon] || FileText;
  const title = n.headline || n.title || "(untitled)";
  const dateLine = n.date || formatNewsDate(n.published_at);
  const url = n.url || "#";
  const hasExternalUrl = url && url !== "#";
  return (
    <a
      href={url}
      target={hasExternalUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={`flex items-center gap-3.5 px-5 py-4 hover:bg-[#F8FAFC] transition-colors ${isLast ? "" : "border-b border-[#F1F5F9]"}`}
      data-testid={`news-${n.id || n.url}`}
    >
      <div className="w-9 h-9 rounded-md bg-[#E8F5F0] text-[#0D9373] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-[14px] font-semibold text-[#0A1628] leading-snug truncate" title={title}>{title}</div>
        <div className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-2">
          {n.source && <span className="font-medium text-[#0D9373]">{n.source}</span>}
          {n.source && dateLine && <span className="text-[#CBD5E1]">·</span>}
          {dateLine && <span>{dateLine}</span>}
        </div>
      </div>
    </a>
  );
}

const TONE_STYLES = {
  teal:  { dot: "#0D9373", pill: { bg: "#E8F5F0", color: "#0A7B59", border: "rgba(13,147,115,0.25)" } },
  amber: { dot: "#D97706", pill: { bg: "#FEF3C7", color: "#92400E", border: "rgba(217,119,6,0.35)" } },
};

// Map API status → visual tone (placeholders use `tone`+`statusLabel` directly;
// API uses `status` ∈ {New, Upcoming, Released} + optional `date_label`).
function normalizeCert(c) {
  if (c.tone && c.statusLabel) return c; // already in placeholder shape
  const status = c.status || "Released";
  const tone = status === "New" ? "teal" : status === "Upcoming" ? "amber" : "teal";
  return { ...c, tone, statusLabel: c.date_label || status };
}

export function CertRow({ c, isLast }) {
  const n = normalizeCert(c);
  const tone = TONE_STYLES[n.tone] || TONE_STYLES.teal;
  return (
    <div
      className={`flex items-center gap-3.5 px-5 py-4 ${isLast ? "" : "border-b border-[#F1F5F9]"}`}
      data-testid={`cert-${n.id}`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.dot }} />
      <div className="flex-1 min-w-0 font-heading text-[14px] font-semibold text-[#0A1628] leading-snug">{n.name}</div>
      <span
        className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
        style={{ background: tone.pill.bg, color: tone.pill.color, borderColor: tone.pill.border }}
      >
        {n.statusLabel}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Ecosystem() {
  const [news, setNews] = useState(PLACEHOLDER_NEWS);
  const [events, setEvents] = useState(PLACEHOLDER_EVENTS);
  const [certs, setCerts] = useState(PLACEHOLDER_CERTS);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/news?limit=5")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled && Array.isArray(items) && items.length > 0) setNews(items);
      })
      .catch(() => { /* keep placeholder */ });
    api.get("/ecosystem/events")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled && Array.isArray(items) && items.length > 0) setEvents(items);
      })
      .catch(() => { /* keep placeholder */ });
    api.get("/ecosystem/certifications")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled && Array.isArray(items) && items.length > 0) setCerts(items);
      })
      .catch(() => { /* keep placeholder */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-page">
      <NavHeader />

      {/* Hero */}
      <section className="bg-[#0A1628] text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 lg:py-14">
          <div className="text-xs uppercase tracking-[0.18em] text-[#0D9373] font-bold mb-3">HCMORBIT ECOSYSTEM</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            Stay current with the Workday world
          </h1>
          <p className="mt-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed">
            Events, certifications, and community news — curated for Workday practitioners.
          </p>
        </div>
      </section>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-12">

        {/* Upcoming events */}
        <section className="mb-12" data-testid="events-section">
          <SectionHeader icon={Calendar} title="Upcoming events" viewAllHref="/ecosystem/events" dataTestId="events-section-header" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="events-list">
            {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </div>
        </section>

        {/* News + Certifications — 2-col on desktop */}
        <section className="grid lg:grid-cols-2 gap-6 lg:gap-8">

          <div data-testid="news-section">
            <SectionHeader icon={Newspaper} title="Community news" viewAllHref="/ecosystem/news" dataTestId="news-section-header" />
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden" data-testid="news-list">
              {news.map((n, i) => <NewsRow key={n.id} n={n} isLast={i === news.length - 1} />)}
            </div>
          </div>

          <div data-testid="certs-section">
            <SectionHeader icon={ClipboardList} title="Certification watch" viewAllHref="/ecosystem/certifications" dataTestId="certs-section-header" />
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden" data-testid="certs-list">
              {certs.map((c, i) => <CertRow key={c.id} c={c} isLast={i === certs.length - 1} />)}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarPlus,
  Download,
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

// Per-type styling for the EventCard banner: dark solid background + large
// accent-colored type word + small subtitle line below. Matches the spec
// banner design (no gradient, no pill).
const CATEGORY_BANNER = {
  RUG:        { bg: "#0A1628", accent: "#0D9373", subtitle: "Regional User Group" },
  CONFERENCE: { bg: "#0C2A5E", accent: "#5B9BD5", subtitle: "Workday Official" },
  WEBINAR:    { bg: "#2D1B69", accent: "#A78BFA", subtitle: "Online Session" },
  DEFAULT:    { bg: "#0A1628", accent: "#0D9373", subtitle: "Workday Community Event" },
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

/**
 * Parse a date-only string ("YYYY-MM-DD") into a *local* Date.
 *
 * `new Date("2026-06-30")` interprets the string as **UTC midnight**, which
 * then formats back to June 29 in any timezone west of UTC (e.g. CT). The
 * event admin saves a calendar day, not an instant — so we must use the
 * local-Date constructor (year, monthIndex, day) to avoid the rollback.
 *
 * Returns null when the string isn't a YYYY-MM-DD prefix.
 */
function parseLocalDateOnly(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((s || "").trim());
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
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

// ── .ics download helpers ──────────────────────────────────────────────────

/** Escape a value for ICS text fields per RFC 5545. */
function icsEscape(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Build RFC-5545-compliant VCALENDAR/VEVENT text for `ev`. Returns null on no date. */
export function buildIcsContent(ev) {
  const dateCompact = compactDate(ev.date);
  if (!dateCompact) return null;

  const range = parseTimeRange(ev.time);
  const tzAbbrev = (ev.timezone || "").toUpperCase().replace(/[^A-Z]/g, "");
  const iana = TZ_ABBREV_TO_IANA[tzAbbrev];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${ev.id || dateCompact}-${Math.random().toString(36).slice(2, 8)}@hcmorbit.com`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HCMOrbit//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
  ];

  if (range) {
    const [s, e] = range;
    const tzParam = iana ? `;TZID=${iana}` : "";
    lines.push(`DTSTART${tzParam}:${dateCompact}T${pad(s.h)}${pad(s.m)}00`);
    lines.push(`DTEND${tzParam}:${dateCompact}T${pad(e.h)}${pad(e.m)}00`);
  } else {
    // All-day: DTEND is exclusive (next day).
    const y = parseInt(dateCompact.slice(0, 4), 10);
    const m = parseInt(dateCompact.slice(4, 6), 10);
    const d = parseInt(dateCompact.slice(6, 8), 10);
    const nd = new Date(Date.UTC(y, m - 1, d + 1));
    const endCompact = `${nd.getUTCFullYear()}${pad(nd.getUTCMonth() + 1)}${pad(nd.getUTCDate())}`;
    lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    lines.push(`DTEND;VALUE=DATE:${endCompact}`);
  }

  lines.push(`SUMMARY:${icsEscape(ev.title || "Workday community event")}`);
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);

  const host = ev.host || ev.sponsor;
  const regUrl = ev.url || ev.register_url;
  const descParts = [];
  if (host) descParts.push(`Host: ${host}`);
  if (regUrl && regUrl !== "#") descParts.push(`Register: ${regUrl}`);
  descParts.push("Shared via HCMOrbit");
  lines.push(`DESCRIPTION:${icsEscape(descParts.join("\n"))}`);
  if (regUrl && regUrl !== "#") lines.push(`URL:${regUrl}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Make a safe filename like `denver-rug-2026.ics` from event title + year. */
export function icsFilename(ev) {
  const slug = (ev.title || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
  const year = (ev.date || "").slice(0, 4) || "tba";
  // Avoid "rising-2026-2026.ics" when the title already contains the year.
  const base = slug.endsWith(`-${year}`) || slug === year ? slug : `${slug}-${year}`;
  return `${base}.ics`;
}

/** Trigger a browser download of the event as an .ics file. */
function downloadIcs(ev) {
  const content = buildIcsContent(ev);
  if (!content) return;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFilename(ev);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EventCard({ ev, expanded = false }) {
  // Tolerate both shapes: placeholder ({category, date, host, location, url}) and
  // API ({event_type, date, time, timezone, sponsor, location, register_url}).
  const category = ev.category || ev.event_type || "DEFAULT";
  const categoryKey = category === "Conference" ? "CONFERENCE"
                    : category === "Webinar"    ? "WEBINAR"
                    : category;
  const banner = CATEGORY_BANNER[categoryKey] || CATEGORY_BANNER.DEFAULT;
  const host = ev.host || ev.sponsor;
  const url = ev.url || ev.register_url || "#";

  // Temporal mode — drives the date line, the recurrence badge and whether
  // we render the calendar export controls.
  const isOnDemand = !!ev.is_on_demand;
  const isRecurring = !!ev.is_recurring;
  // Prefer the backend-computed `next_date` (handles rollforward for recurring
  // series); otherwise fall back to whatever the source provided.
  const effectiveDate = isOnDemand ? null : (ev.next_date || ev.date || "");
  const gcalUrl = isOnDemand ? null : buildGoogleCalendarUrl({ ...ev, date: effectiveDate });
  const icsAvailable = !isOnDemand && !!compactDate(effectiveDate);

  // Format date line: prefer combined placeholder string; otherwise build from API fields.
  let dateLine = "";
  if (isOnDemand) {
    dateLine = "On demand";
  } else {
    dateLine = effectiveDate || "";
    if (dateLine && !dateLine.includes("·")) {
      // For date-only strings ("YYYY-MM-DD"), avoid the UTC-midnight rollback
      // bug: `new Date("2026-06-30")` becomes 2026-06-29 in CT. Parse the
      // numeric parts into a *local* Date instead.
      const localDate = parseLocalDateOnly(dateLine);
      if (localDate) {
        dateLine = localDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
      } else {
        try {
          const d = new Date(dateLine);
          if (!Number.isNaN(d.getTime())) {
            dateLine = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
          }
        } catch { /* leave as-is */ }
      }
      if (ev.time) dateLine += ` · ${ev.time}`;
      if (ev.timezone) dateLine += ` ${ev.timezone}`;
    }
  }
  const recurrenceBadge = isRecurring
    ? (ev.recurrence_rule === "weekly" ? "Weekly" : "Monthly")
    : null;
  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      data-testid={`event-${ev.id}`}
    >
      {/* Solid dark banner with large type word + subtitle, per spec */}
      <div
        className="h-[160px] relative overflow-hidden flex flex-col items-center justify-center"
        style={{ background: banner.bg }}
        data-testid={`event-${ev.id}-banner`}
      >
        <span
          className="font-extrabold leading-none whitespace-nowrap text-[42px]"
          style={{ color: banner.accent }}
          data-testid={`event-${ev.id}-type`}
        >
          {category === "DEFAULT" ? "Event" : category}
        </span>
        <span
          className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: banner.accent, opacity: 0.6 }}
          data-testid={`event-${ev.id}-subtitle`}
        >
          {banner.subtitle}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="font-heading text-lg font-semibold text-[#0A1628] leading-snug">{ev.title}</h3>
        <ul className="space-y-1.5 text-[13px] text-[#475569]">
          <li className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#0D9373] shrink-0 mt-0.5" />
            <span className="flex items-center gap-2">
              <span data-testid={`event-${ev.id}-date`}>{dateLine}</span>
              {recurrenceBadge && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#F3E8FF] text-[#7E22CE] text-[10px] font-semibold uppercase tracking-wider border border-[#D8B4FE]"
                  data-testid={`event-${ev.id}-recurrence-badge`}
                >
                  {recurrenceBadge}
                </span>
              )}
            </span>
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
        {ev.description && (
          <p
            className={`text-[13px] text-[#475569] leading-relaxed ${expanded ? "whitespace-pre-line" : "line-clamp-2"}`}
            data-testid={`event-${ev.id}-description`}
          >
            {ev.description}
          </p>
        )}
        <a
          href={url}
          target={url && url !== "#" ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-md border border-[#E2E8F0] text-sm font-semibold text-[#0A1628] hover:border-[#0D9373] hover:text-[#0D9373] transition-colors"
          data-testid={`event-${ev.id}-register`}
        >
          Register now <ArrowRight className="w-3.5 h-3.5" />
        </a>
        {(gcalUrl || icsAvailable) && (
          <div className="flex items-center justify-center gap-4">
            {gcalUrl && (
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0D9373] transition-colors"
                data-testid={`event-${ev.id}-add-to-calendar`}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Add to calendar
              </a>
            )}
            {icsAvailable && (
              <button
                type="button"
                onClick={() => downloadIcs({ ...ev, date: effectiveDate })}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0D9373] transition-colors"
                data-testid={`event-${ev.id}-download-ics`}
              >
                <Download className="w-3.5 h-3.5" />
                Download .ics
              </button>
            )}
          </div>
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

// ── Tile variants (used on the Ecosystem hub grid) ─────────────────────────

export function NewsTile({ n }) {
  const title = n.headline || n.title || "(untitled)";
  const dateLine = n.date || formatNewsDate(n.published_at);
  const url = n.url || "#";
  const hasExternalUrl = url && url !== "#";
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!n.image_url && !imgFailed;
  return (
    <a
      href={url}
      target={hasExternalUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="group bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col hover:shadow-md hover:border-[#0D9373]/30 transition-all"
      data-testid={`news-tile-${n.id || n.url}`}
    >
      <div
        className="h-[140px] relative flex items-center justify-center overflow-hidden bg-[#0A1628]"
      >
        {showImage ? (
          <img
            src={n.image_url}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          // Brand mark fallback — mirrors the NavHeader logo (navy square + teal dot)
          // but scaled up to fill the tile area.
          <div
            className="w-16 h-16 rounded-lg bg-[#0A1628] flex items-center justify-center ring-1 ring-white/10 group-hover:ring-[#0D9373]/30 transition-all"
            aria-label="HCMOrbit"
          >
            <div className="w-7 h-7 rounded-full bg-[#0D9373] group-hover:scale-110 transition-transform" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-2.5 flex-1">
        <h3 className="font-heading text-[15px] font-semibold text-[#0A1628] leading-snug line-clamp-3 group-hover:text-[#0D9373] transition-colors">
          {title}
        </h3>
        <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-[#94A3B8]">
          {n.source && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#E8F5F0] text-[#0A7B59] font-semibold text-[11px]">
              {n.source}
            </span>
          )}
          {dateLine && <span>{dateLine}</span>}
        </div>
      </div>
    </a>
  );
}

const STATUS_TONE = {
  New:       { tone: "teal",  band: "linear-gradient(135deg, #134E4A 0%, #0D9373 100%)" },
  Upcoming:  { tone: "amber", band: "linear-gradient(135deg, #92400E 0%, #D97706 100%)" },
  Released:  { tone: "teal",  band: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" },
};

export function CertTile({ c }) {
  const n = normalizeCert(c);
  // Prefer the API's raw status word for the big pill; placeholder uses statusLabel.
  const statusWord = c.status || (n.tone === "amber" ? "Upcoming" : "New");
  const toneCfg = STATUS_TONE[statusWord] || STATUS_TONE.New;
  const tone = TONE_STYLES[toneCfg.tone] || TONE_STYLES.teal;
  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      data-testid={`cert-tile-${n.id}`}
    >
      {/* Colored band with large status pill */}
      <div className="h-[100px] relative" style={{ background: toneCfg.band }}>
        <span
          className="absolute left-5 bottom-5 inline-flex items-center px-3 py-1 rounded-md text-[12px] font-bold uppercase tracking-wider border bg-white/95"
          style={{ color: tone.pill.color, borderColor: tone.pill.border }}
        >
          {statusWord}
        </span>
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <h3 className="font-heading text-[15px] font-semibold text-[#0A1628] leading-snug">
          {n.name}
        </h3>
        {n.date_label && (
          <div className="mt-auto pt-2 text-xs text-[#64748B]">{n.date_label}</div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Ecosystem() {
  const [news, setNews] = useState(PLACEHOLDER_NEWS);
  const [events, setEvents] = useState(PLACEHOLDER_EVENTS);
  const [certs, setCerts] = useState(PLACEHOLDER_CERTS);

  // Hub-only featured-events pick: one earliest future event per type, ordered
  // RUG → Conference → Webinar. Slots with no candidate are skipped gracefully.
  // Tolerates both API (`event_type` + ISO `date`) and placeholder (`category`
  // + combined date string) shapes.
  const featuredEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const eventDateKey = (ev) => {
      // ISO "YYYY-MM-DD" sorts lexicographically; placeholder strings (e.g.
      // "June 17, 2026 · 4:00 PM MT") get coerced via Date as a fallback.
      const raw = (ev.date || "").toString();
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const d = new Date(raw.split("·")[0]);
      return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    };
    const eventType = (ev) => ev.event_type || ev.category || null;
    const earliestFuture = (type) =>
      events
        .filter((ev) => eventType(ev) === type)
        .filter((ev) => {
          const k = eventDateKey(ev);
          return k === "" || k >= today;  // keep undated entries as candidates
        })
        .sort((a, b) => (eventDateKey(a) || "9999").localeCompare(eventDateKey(b) || "9999"))[0];
    return ["RUG", "Conference", "Webinar"]
      .map((t) => earliestFuture(t))
      .filter(Boolean);
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/news?limit=6")
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

        {/* Upcoming events — one earliest future event per type (RUG → Conference → Webinar). */}
        <section className="mb-12" data-testid="events-section">
          <SectionHeader icon={Calendar} title="Upcoming events" viewAllHref="/ecosystem/events" dataTestId="events-section-header" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="events-list">
            {featuredEvents.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </div>
        </section>

        {/* Community news — 3-col tile grid */}
        <section className="mb-12" data-testid="news-section">
          <SectionHeader icon={Newspaper} title="Community news" viewAllHref="/ecosystem/news" dataTestId="news-section-header" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="news-list">
            {news.slice(0, 6).map((n) => <NewsTile key={n.id || n.url} n={n} />)}
          </div>
        </section>

        {/* Certification watch — 3-col tile grid */}
        <section data-testid="certs-section">
          <SectionHeader icon={ClipboardList} title="Certification watch" viewAllHref="/ecosystem/certifications" dataTestId="certs-section-header" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="certs-list">
            {certs.slice(0, 6).map((c) => <CertTile key={c.id} c={c} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

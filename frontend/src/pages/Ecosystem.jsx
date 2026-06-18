import React, { useEffect, useState } from "react";
import { Calendar, Newspaper, Award, ExternalLink, MapPin, Clock } from "lucide-react";
import NavHeader from "../components/NavHeader";
import { api } from "../lib/api";

// Hardcoded fallback / placeholder data ────────────────────────────────────

const PLACEHOLDER_EVENTS = [
  {
    id: "evt-rising-2026",
    title: "Workday Rising 2026",
    org: "Workday Inc.",
    date: "Sep 14–17, 2026",
    location: "Las Vegas, NV",
    format: "In-person",
    summary: "The flagship Workday conference — product announcements, certification updates, and 350+ breakout sessions for HCM, Financials, and Adaptive Planning.",
    url: "https://www.workday.com/en-us/company/events/rising.html",
  },
  {
    id: "evt-dev-summit-26",
    title: "Workday DevCon",
    org: "Workday Developer",
    date: "May 6–8, 2026",
    location: "San Francisco, CA",
    format: "Hybrid",
    summary: "Hands-on technical sessions on Studio integrations, Prism Analytics, Workday Extend, and the Developer Toolkit. Limited to 1,200 attendees.",
    url: "#",
  },
  {
    id: "evt-hr-tech-26",
    title: "HR Technology Conference",
    org: "LRP Publications",
    date: "Oct 12–15, 2026",
    location: "Las Vegas, NV",
    format: "In-person",
    summary: "Ecosystem-wide HR tech conference covering Workday, SAP SuccessFactors, Oracle HCM Cloud — great for SI partners and analysts.",
    url: "#",
  },
  {
    id: "evt-wd-academy-india",
    title: "Workday Academy India Meet-up",
    org: "Workday India Community",
    date: "Mar 22, 2026",
    location: "Bengaluru, IN",
    format: "In-person",
    summary: "Quarterly community meet-up for the Workday practitioner community in India. Lightning talks + open Q&A with senior consultants.",
    url: "#",
  },
];

const PLACEHOLDER_NEWS = [
  {
    id: "news-r1-2026",
    headline: "Workday 2026R1 release window confirmed — March 14",
    source: "Workday Community",
    posted: "2 days ago",
    summary: "Highlights include Generative AI in Workday Assistant for HR helpdesk, new VNDLY Talent Marketplace surfaces, and accelerated Prism dashboards.",
    url: "#",
  },
  {
    id: "news-extend-ga",
    headline: "Workday Extend GA in India + APAC data centers",
    source: "Workday Blog",
    posted: "5 days ago",
    summary: "Customers in regulated APAC regions can now run custom Extend apps on Workday's Indian data residency tier — closing a long-standing compliance gap.",
    url: "#",
  },
  {
    id: "news-cert-refresh",
    headline: "HCM Pro certification refresh: what changed in v6",
    source: "HCMOrbit Editorial",
    posted: "1 week ago",
    summary: "Workday quietly updated the HCM Pro path: 4 new required topics on Job Architecture and Talent Optimization. Older v5 holders have 90 days to re-cert.",
    url: "#",
  },
  {
    id: "news-prism-adoption",
    headline: "Customer adoption of Prism Analytics crosses 40%",
    source: "Workday Insights",
    posted: "2 weeks ago",
    summary: "Workday reports that 40% of HCM customers have now adopted Prism for cross-source reporting — up from 22% YoY.",
    url: "#",
  },
  {
    id: "news-sec-domain-changes",
    headline: "Security domain restructuring impacts integrations in 2026R1",
    source: "Workday Community",
    posted: "3 weeks ago",
    summary: "Two new security domains are being introduced for Worker Documents and Org Studio. Integration teams should review ISU domain access before Mar 14.",
    url: "#",
  },
];

const PLACEHOLDER_CERTS = [
  {
    id: "cert-hcm-pro-v6",
    name: "HCM Pro v6",
    status: "New requirements",
    statusTone: "amber",
    detail: "4 new topics added: Job Architecture, Talent Optimization, Compensation Eligibility, Performance Cycles. v5 holders must re-certify by Jun 30, 2026.",
    track: "Functional",
  },
  {
    id: "cert-pro-integration",
    name: "Pro Integration",
    status: "Stable",
    statusTone: "green",
    detail: "No structural changes in 2026R1. Studio + Core Connectors questions modernized to reflect the v51 SOAP API generation.",
    track: "Technical",
  },
  {
    id: "cert-extend-builder",
    name: "Extend App Builder",
    status: "Beta",
    statusTone: "teal",
    detail: "First-ever Extend-specific certification, currently in closed beta. Targeted GA: Workday Rising 2026.",
    track: "Technical",
  },
  {
    id: "cert-prism-architect",
    name: "Prism Analytics Architect",
    status: "Refresh announced",
    statusTone: "amber",
    detail: "New exam form launching Apr 2026 — adds dataset lineage, blend-with-Workday, and Workday Reporting integration scenarios.",
    track: "Reporting",
  },
];

// ── Components ──────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  green: "bg-[#0D9373]/10 text-[#0A7B59] border-[#0D9373]/30",
  amber: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]/60",
  teal:  "bg-[#E0F2FE] text-[#075985] border-[#7DD3FC]/60",
};

function SectionHeader({ icon: Icon, title, subtitle, dataTestId }) {
  return (
    <div className="flex items-start gap-3 mb-5" data-testid={dataTestId}>
      <div className="w-10 h-10 rounded-lg bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-tight">{title}</h2>
        <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function EventCard({ ev }) {
  return (
    <a
      href={ev.url || "#"}
      target={ev.url && ev.url !== "#" ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373]/40 hover:shadow-sm transition-all"
      data-testid={`event-${ev.id}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9373] uppercase tracking-wider mb-2">
        <Calendar className="w-3.5 h-3.5" />
        {ev.date}
      </div>
      <h3 className="font-heading text-base font-semibold text-[#0A1628] mb-1.5 leading-snug">{ev.title}</h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] mb-3">
        <span>{ev.org}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.location}</span>
        <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-medium">{ev.format}</span>
      </div>
      <p className="text-sm text-[#475569] leading-relaxed line-clamp-3">{ev.summary}</p>
    </a>
  );
}

function NewsRow({ n }) {
  return (
    <a
      href={n.url || "#"}
      target={n.url && n.url !== "#" ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="block bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373]/40 hover:shadow-sm transition-all"
      data-testid={`news-${n.id}`}
    >
      <div className="flex items-center gap-2 text-xs text-[#64748B] mb-2">
        <span className="font-semibold text-[#0D9373] uppercase tracking-wider">{n.source}</span>
        <span className="text-[#CBD5E1]">•</span>
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {n.posted}</span>
      </div>
      <h3 className="font-heading text-[15px] font-semibold text-[#0A1628] mb-1.5 leading-snug">{n.headline}</h3>
      <p className="text-sm text-[#475569] leading-relaxed line-clamp-2">{n.summary}</p>
    </a>
  );
}

function CertCard({ c }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5" data-testid={`cert-${c.id}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-heading text-base font-semibold text-[#0A1628] leading-tight">{c.name}</h3>
          <div className="text-[11px] uppercase tracking-wider text-[#94A3B8] mt-1">{c.track}</div>
        </div>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[c.statusTone] || STATUS_STYLES.green}`}>
          {c.status}
        </span>
      </div>
      <p className="text-sm text-[#475569] leading-relaxed mt-2">{c.detail}</p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Ecosystem() {
  const [news, setNews] = useState(PLACEHOLDER_NEWS);
  const [newsSource, setNewsSource] = useState("placeholder"); // "placeholder" | "live"

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/news?limit=5")
      .then((r) => {
        // Accept either an array or { items: [...] } shape
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled && Array.isArray(items) && items.length > 0) {
          setNews(items);
          setNewsSource("live");
        }
      })
      .catch(() => { /* endpoint not deployed yet — keep placeholder */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-page">
      <NavHeader />

      <section className="bg-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[500px] rounded-full bg-[#0D9373]/10 blur-[120px]" />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-8 py-14">
          <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">The Workday Ecosystem</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl">What&apos;s happening in the Workday world.</h1>
          <p className="mt-4 text-lg text-white/70 max-w-2xl">Upcoming events, release-cycle news, and certification updates curated for HCM practitioners — refreshed regularly.</p>
        </div>
      </section>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 space-y-14">

        <section data-testid="events-section">
          <SectionHeader
            icon={Calendar}
            title="Events"
            subtitle="Conferences, meet-ups, and community sessions worth your time."
            dataTestId="events-section-header"
          />
          <div className="grid sm:grid-cols-2 gap-4" data-testid="events-list">
            {PLACEHOLDER_EVENTS.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </div>
        </section>

        <section data-testid="news-section">
          <SectionHeader
            icon={Newspaper}
            title="Community News"
            subtitle="Release notes, blog posts, and conversations worth catching up on."
            dataTestId="news-section-header"
          />
          {newsSource === "placeholder" && (
            <div className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-3" data-testid="news-source-label">
              Curated highlights · live feed coming soon
            </div>
          )}
          <div className="flex flex-col gap-3" data-testid="news-list">
            {news.map((n) => <NewsRow key={n.id} n={n} />)}
          </div>
        </section>

        <section data-testid="certs-section">
          <SectionHeader
            icon={Award}
            title="Certification Watch"
            subtitle="Workday certification track changes, refresh windows, and new beta paths."
            dataTestId="certs-section-header"
          />
          <div className="grid sm:grid-cols-2 gap-4" data-testid="certs-list">
            {PLACEHOLDER_CERTS.map((c) => <CertCard key={c.id} c={c} />)}
          </div>
        </section>

        <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8 text-center" data-testid="ecosystem-cta">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0D9373] mb-2">
            <ExternalLink className="w-3.5 h-3.5" /> Got news to share?
          </div>
          <h3 className="font-heading text-xl font-semibold text-[#0A1628] mb-2">Help us keep the ecosystem feed sharp.</h3>
          <p className="text-sm text-[#475569] max-w-xl mx-auto">
            Tell us about an event, release detail, or certification change worth surfacing here —
            we&apos;ll review and feature it for the community.
          </p>
        </section>

      </main>
    </div>
  );
}

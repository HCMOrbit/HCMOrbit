/**
 * Industry Pulse dashboard — /ecosystem/industry-pulse.
 *
 * Frontend-first: every data point comes from GET /api/intel/industry-pulse.
 * There is deliberately zero hardcoded industry data in this component so the
 * dashboard flips over to real signals when the Phase 2 crawler lands, with
 * no frontend edits required.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, Flame, Sparkles, Banknote, Shield,
  Users, ChevronDown, BarChart3, Building2, Landmark, Store, Cpu,
  Factory, GraduationCap, Briefcase, Clock, Plug, Code, Gavel, Info, ArrowRight,
  Calendar as CalendarIcon, MapPin, Circle, GitCompare,
} from "lucide-react";
import { Link } from "react-router-dom";
import NavHeader from "../../components/NavHeader";
import { api } from "../../lib/api";

// ---------- palette (aligned with reference image) ---------------------------
const P = {
  navy: "#0A1628",
  navyDark: "#050D1B",
  teal: "#0D9373",
  tealLight: "#1DB589",
  amber: "#F5B731",
  ink: "#0F172A",
  sub: "#475569",
  muted: "#94A3B8",
  line: "#E2E8F0",
  page: "#F8FAFC",
  card: "#FFFFFF",
  redSoft: "#FEE2E2",
  redText: "#B91C1C",
  amberSoft: "#FEF3C7",
  amberText: "#92400E",
  blueSoft: "#DBEAFE",
  blueText: "#1E40AF",
  greenSoft: "#DCFCE7",
  greenText: "#166534",
  slateSoft: "#F1F5F9",
  slateText: "#475569",
};

const INDUSTRY_ICONS = {
  "Healthcare": Building2,
  "Financial Services": Landmark,
  "Retail": Store,
  "Technology": Cpu,
  "Manufacturing": Factory,
  "Public Sector": Gavel,
  "Higher Education": GraduationCap,
  "Professional Services": Briefcase,
};

const TREND_ICON_MAP = {
  sparkles: Sparkles,
  banknote: Banknote,
  shield: Shield,
  users: Users,
  clock: Clock,
  plug: Plug,
  chart: BarChart3,
  code: Code,
  gavel: Gavel,
  building: Building2,
};

// ---------- shared chip helpers ---------------------------------------------
const DEMAND_STYLE = {
  "Very High": { bg: P.redSoft, fg: P.redText },
  "High":      { bg: P.amberSoft, fg: P.amberText },
  "Medium":    { bg: P.blueSoft, fg: P.blueText },
  "Emerging":  { bg: P.slateSoft, fg: P.slateText },
  "Low":       { bg: P.slateSoft, fg: P.slateText },
};

function Chip({ children, bg, fg, testId }) {
  return (
    <span
      data-testid={testId}
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function DemandChip({ level, testId }) {
  const s = DEMAND_STYLE[level] || DEMAND_STYLE["Medium"];
  return <Chip bg={s.bg} fg={s.fg} testId={testId}>{level}</Chip>;
}

function TrendArrow({ direction }) {
  if (direction === "up") return <TrendingUp className="w-3.5 h-3.5" style={{ color: P.teal }} />;
  if (direction === "down") return <TrendingDown className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: P.muted }} />;
}

// ---------- hero -------------------------------------------------------------
function Hero() {
  return (
    <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-8">
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
          borderRadius: 18,
          padding: "38px 32px 44px",
          color: "#fff",
        }}
        data-testid="ip-hero"
      >
        {/* Faint chart background — kept from previous design as an ambient
            decoration. Amber tint on the top line matches the new eyebrow. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute right-0 top-6 opacity-40 hidden md:block"
          width="580" height="360" viewBox="0 0 580 360" fill="none"
        >
          <defs>
            <linearGradient id="ipLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={P.teal} stopOpacity="0.05" />
              <stop offset="1" stopColor={P.teal} stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path d="M0,300 L60,290 L120,270 L180,260 L240,230 L300,200 L360,170 L420,140 L480,90 L540,50 L580,20"
                stroke="url(#ipLine)" strokeWidth="2" fill="none" />
          <path d="M0,320 L80,310 L160,295 L240,280 L320,255 L400,220 L480,180 L580,130"
                stroke={P.teal} strokeOpacity="0.25" strokeWidth="1.5" fill="none" />
          {[[540,50], [480,90], [420,140], [360,170], [300,200], [240,230]].map(([x,y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={P.teal} />
          ))}
        </svg>

        <div className="relative">
          <nav className="text-xs flex items-center gap-1.5 mb-5 text-white/70" data-testid="ip-breadcrumb">
            <a href="/" className="hover:text-white">Home</a>
            <span>›</span>
            <a href="/ecosystem" className="hover:text-white" style={{ color: "#F5B731" }}>Ecosystem</a>
            <span>›</span>
            <span className="text-white">Industry Pulse</span>
          </nav>
          <div
            data-testid="ip-eyebrow"
            style={{
              color: "#F5B731",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Industry Pulse
          </div>
          <h1
            className="font-heading"
            style={{
              color: "#ffffff",
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              marginBottom: 16,
            }}
          >
            Where Workday is moving
          </h1>
          <p className="text-white/70 text-base max-w-2xl leading-relaxed mb-6">
            Track where the Workday ecosystem is growing through hiring demand, customer
            implementations, product adoption, partner activity, community trends, AI
            innovation, and upcoming events.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 border"
               style={{ borderColor: "rgba(29, 181, 137, 0.4)", background: "rgba(13, 147, 115, 0.15)" }}
               data-testid="ip-live-badge">
            <Circle className="w-2.5 h-2.5 fill-current" style={{ color: P.tealLight }} />
            <span className="text-sm font-medium" style={{ color: P.tealLight }}>Live Ecosystem Intelligence</span>
          </div>
          <div className="mt-4 text-xs text-white/50">
            Based on aggregated public signals. Not official Workday data.
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- industry filter chips -------------------------------------------
function IndustryFilters({ industries, active, onSelect }) {
  const primary = industries.slice(0, 7);
  const overflow = industries.slice(7);
  const [showMore, setShowMore] = useState(false);
  return (
    <div className="max-w-[1280px] mx-auto px-6 lg:px-10 -mt-8 relative">
      <div className="rounded-2xl bg-white p-4 lg:p-5 flex items-center gap-3 flex-wrap"
           style={{ boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)", border: `1px solid ${P.line}` }}
           data-testid="ip-industry-filters">
        <div className="flex items-center gap-2 pr-2 mr-1" style={{ borderRight: `1px solid ${P.line}` }}>
          <span className="text-sm font-semibold" style={{ color: P.ink }}>Workday by industry</span>
          <div title="Community-signal aggregate — not official data"
               className="inline-flex items-center gap-1 text-xs" style={{ color: P.muted }}>
            <Info className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Illustrative — community signal, not official data</span>
          </div>
        </div>
        {primary.map((ind) => {
          const Icon = INDUSTRY_ICONS[ind.name] || Building2;
          const isActive = ind.name === active;
          return (
            <button
              key={ind.name}
              onClick={() => onSelect(ind.name)}
              data-testid={`ip-industry-${ind.name.replace(/\s+/g, "-").toLowerCase()}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition"
              style={{
                border: `1px solid ${isActive ? P.teal : P.line}`,
                background: isActive ? "rgba(13, 147, 115, 0.10)" : "#fff",
                color: isActive ? P.teal : P.ink,
                cursor: "pointer",
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {ind.name}
            </button>
          );
        })}
        {overflow.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-medium"
              style={{ border: `1px solid ${P.line}`, background: "#fff", color: P.ink }}
              data-testid="ip-industry-more"
            >
              More <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
            </button>
            {showMore && (
              <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg z-20 min-w-[220px]"
                   style={{ border: `1px solid ${P.line}` }}>
                {overflow.map((ind) => {
                  const Icon = INDUSTRY_ICONS[ind.name] || Building2;
                  return (
                    <button
                      key={ind.name}
                      onClick={() => { onSelect(ind.name); setShowMore(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                      data-testid={`ip-industry-more-${ind.name.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: P.sub }} />
                      {ind.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- summary card ----------------------------------------------------
function KPI({ icon: Icon, label, value, trailing = "vs last quarter", accent = P.teal, testId }) {
  return (
    <div className="flex-1 min-w-[140px]" data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: "rgba(13, 147, 115, 0.12)" }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div className="text-xs" style={{ color: P.sub }}>{label}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color: P.ink }}>{value}</div>
      <div className="text-[11px]" style={{ color: P.muted }}>{trailing}</div>
    </div>
  );
}

function IndustrySummary({ industry, description, summary }) {
  const Icon = INDUSTRY_ICONS[industry] || Building2;
  return (
    <div className="rounded-2xl bg-white p-6 lg:p-7 flex flex-col lg:flex-row gap-6"
         style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-industry-summary">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
               style={{ background: "rgba(13, 147, 115, 0.12)" }}>
            <Icon className="w-6 h-6" style={{ color: P.teal }} />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: P.ink }} data-testid="ip-industry-name">{industry}</h2>
        </div>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: P.sub }}>{description}</p>
      </div>
      <div className="flex flex-wrap gap-5 lg:gap-8 items-start lg:pl-6 lg:border-l" style={{ borderColor: P.line }}>
        <KPI icon={Users} label="Hiring Demand" value={summary.hiring_demand} testId="ip-kpi-hiring" />
        <KPI icon={BarChart3} label="Active Job Postings" value={summary.active_job_postings.toLocaleString()} testId="ip-kpi-postings" />
        <KPI icon={Building2} label="Customer Go-Lives" value={summary.customer_go_lives_count} testId="ip-kpi-golives" />
        <KPI icon={TrendingUp} label="Workday Adoption" value={summary.adoption_trend} testId="ip-kpi-adoption" />
      </div>
    </div>
  );
}

// ---------- module adoption bars --------------------------------------------
function AdoptionBar({ row }) {
  const { module, high_adoption_percent: h, adopting_percent: a, early_adoption_percent: e, trend_direction } = row;
  return (
    <div className="grid grid-cols-[180px_1fr_20px] items-center gap-3 py-2" data-testid={`ip-adoption-${module.replace(/\s+/g, "-").replace(/\//g, "-").toLowerCase()}`}>
      <div className="text-sm flex items-center gap-2" style={{ color: P.ink }}>
        <Circle className="w-2 h-2 fill-current" style={{ color: P.muted }} />
        <span className="truncate">{module}</span>
      </div>
      <div className="flex items-center overflow-hidden rounded-full h-6 w-full" style={{ background: P.slateSoft }}>
        <div style={{ width: `${h}%`, background: P.teal, height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "flex-end",
                      paddingRight: h > 8 ? 8 : 0, color: "#fff", fontSize: 11, fontWeight: 700,
                      borderRadius: "999px 0 0 999px" }}>
          {h > 8 ? `${h}%` : ""}
        </div>
        <div style={{ width: `${a}%`, background: P.amber, height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "flex-end",
                      paddingRight: a > 8 ? 8 : 0, color: "#fff", fontSize: 11, fontWeight: 700 }}>
          {a > 8 ? `${a}%` : ""}
        </div>
        <div style={{ width: `${e}%`, background: "#CBD5E1", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "flex-end",
                      paddingRight: e > 8 ? 8 : 0, color: P.slateText, fontSize: 11, fontWeight: 700,
                      borderRadius: "0 999px 999px 0" }}>
          {e > 8 ? `${e}%` : ""}
        </div>
      </div>
      <TrendArrow direction={trend_direction} />
    </div>
  );
}

function ModuleAdoptionCard({ scores }) {
  return (
    <div className="rounded-2xl bg-white p-6 lg:p-7" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-module-adoption-card">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-base font-bold" style={{ color: P.ink }}>Module adoption in this industry</h3>
          <p className="text-xs" style={{ color: P.sub }}>Based on customer implementations and expansion patterns</p>
        </div>
      </div>
      <div className="grid grid-cols-[180px_1fr_20px] gap-3 pt-3 pb-1 text-[11px] uppercase tracking-wider" style={{ color: P.muted }}>
        <div />
        <div className="grid grid-cols-3 text-center">
          <span>High Adoption</span>
          <span>Adopting</span>
          <span>Early Adoption</span>
        </div>
        <div />
      </div>
      <div className="divide-y" style={{ borderColor: P.line }}>
        {scores.map((s) => <AdoptionBar key={s.module} row={s} />)}
      </div>

      <div className="flex items-center gap-5 flex-wrap mt-5 text-xs" style={{ color: P.sub }}>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: P.teal }} />High Adoption (Mature)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: P.amber }} />Adopting (Growing)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#CBD5E1" }} />Early Adoption (Emerging)</span>
      </div>

      <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: P.slateSoft, color: P.sub }}>
        <span className="font-semibold" style={{ color: P.ink }}>How to read:</span> High Adoption = widely implemented and scaled. Adopting = growing implementations. Early Adoption = early stage pilots or initial rollouts.
      </div>
    </div>
  );
}

// ---------- right rail: high demand + still adopting ------------------------
function HighDemandCard({ industry, items }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-high-demand-card">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-4 h-4" style={{ color: "#DC2626" }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>High demand modules</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: P.sub }}>Top modules driving job market demand in {industry}</p>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.module} className="flex items-center justify-between py-1.5" data-testid={`ip-high-demand-${it.rank}`}>
            <div className="flex items-center gap-3">
              <span className="text-xs w-4" style={{ color: P.muted }}>{it.rank}</span>
              <span className="text-sm" style={{ color: P.ink }}>{it.module}</span>
            </div>
            <DemandChip level={it.demand_level} />
          </div>
        ))}
      </div>
      <button
        onClick={() => window.location.assign(`/ecosystem/industry-pulse/compare?industryA=${encodeURIComponent(industry)}&industryB=${industry === "Financial Services" ? "Healthcare" : "Financial Services"}`)}
        className="mt-4 text-xs font-semibold inline-flex items-center gap-1"
        style={{ color: P.teal, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
        data-testid="ip-view-all-demand"
      >
        View all module demand <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function StillAdoptingCard({ industry, items }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-still-adopting-card">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4" style={{ color: P.teal }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>Modules still being adopted</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: P.sub }}>Significant room for growth in {industry}</p>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.module} className="flex items-center justify-between py-1.5" data-testid={`ip-still-adopting-${it.rank}`}>
            <div className="flex items-center gap-3">
              <span className="text-xs w-4" style={{ color: P.muted }}>{it.rank}</span>
              <span className="text-sm" style={{ color: P.ink }}>{it.module}</span>
            </div>
            <Chip bg={it.stage === "Early Stage" ? P.blueSoft : P.amberSoft}
                  fg={it.stage === "Early Stage" ? P.blueText : P.amberText}>
              {it.stage}
            </Chip>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs py-2" style={{ color: P.muted }}>All modules are broadly adopted in {industry}.</div>
        )}
      </div>
    </div>
  );
}

// ---------- bottom row cards ------------------------------------------------
function TopTrendsCard({ industry, trends }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-trends-card">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4" style={{ color: P.teal }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>Top trends in {industry}</h3>
      </div>
      <div className="space-y-4">
        {trends.map((t, i) => {
          const Icon = TREND_ICON_MAP[t.icon] || Sparkles;
          return (
            <div key={t.id || i} className="flex items-start gap-3" data-testid={`ip-trend-${i}`}>
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                   style={{ background: "rgba(13, 147, 115, 0.12)" }}>
                <Icon className="w-4 h-4" style={{ color: P.teal }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: P.ink }}>{t.title}</div>
                <div className="text-xs mt-0.5 leading-snug" style={{ color: P.sub }}>{t.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentGoLivesCard({ goLives }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-golives-card">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4" style={{ color: P.teal }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>Recent customer go-lives</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: P.sub }}>Latest Workday customer implementations</p>
      <div className="space-y-3">
        {goLives.map((g, i) => (
          <div key={g.id} className="pb-2" style={i < goLives.length - 1 ? { borderBottom: `1px solid ${P.line}` } : {}}
               data-testid={`ip-golive-${i}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold truncate" style={{ color: P.ink }}>{g.customer_name}</div>
              <span className="text-[11px] flex-shrink-0" style={{ color: P.muted }}>{monthLabel(g.announcement_date)}</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: P.sub }}>{(g.modules || []).join(", ")}</div>
          </div>
        ))}
        {goLives.length === 0 && (
          <div className="text-xs py-2" style={{ color: P.muted }}>No recent go-lives on record.</div>
        )}
      </div>
    </div>
  );
}

function TopHiringRolesCard({ roles }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-hiring-card">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4" style={{ color: P.teal }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>Top hiring roles</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: P.sub }}>Most in-demand Workday roles</p>
      <div className="space-y-2">
        {roles.map((r, i) => (
          <div key={r.id} className="flex items-center justify-between py-1.5" data-testid={`ip-role-${i}`}>
            <span className="text-sm" style={{ color: P.ink }}>{r.role}</span>
            <DemandChip level={r.demand_level} />
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingEventsCard({ events }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }}
         data-testid="ip-events-card">
      <div className="flex items-center gap-2 mb-1">
        <CalendarIcon className="w-4 h-4" style={{ color: P.teal }} />
        <h3 className="text-base font-bold" style={{ color: P.ink }}>Upcoming events</h3>
      </div>
      <p className="text-xs mb-3" style={{ color: P.sub }}>Key events for the ecosystem</p>
      <div className="space-y-3">
        {events.map((ev, i) => (
          <div key={ev.id} className="flex items-start gap-3" data-testid={`ip-event-${i}`}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                 style={{ background: "rgba(13, 147, 115, 0.12)" }}>
              <CalendarIcon className="w-4 h-4" style={{ color: P.teal }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: P.ink }}>{ev.title}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: P.sub }}>
                <span>{formatEventDate(ev.start_date)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {ev.virtual ? "Virtual" : ev.location}
                </span>
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-xs py-2" style={{ color: P.muted }}>No industry-specific events scheduled.</div>
        )}
      </div>
      <a href="/ecosystem/upcoming-events" className="mt-4 text-xs font-semibold inline-flex items-center gap-1"
         style={{ color: P.teal }}>
        View all events <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}

function monthLabel(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return iso; }
}
function formatEventDate(iso) {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

// ---------- main page --------------------------------------------------------
export default function EcosystemIndustryPulse() {
  const [industries, setIndustries] = useState([]);
  const [activeIndustry, setActiveIndustry] = useState("Healthcare");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/intel/industries").then((res) => {
      setIndustries(res.data.industries || []);
    }).catch(() => setIndustries([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/intel/industry-pulse?industry=${encodeURIComponent(activeIndustry)}`)
      .then((res) => { if (!cancelled) { setPayload(res.data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setPayload(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [activeIndustry]);

  const showSampleBadge = payload?.is_sample_data;

  return (
    <div style={{ background: P.page, minHeight: "100vh" }}>
      <NavHeader />
      <Hero />
      <IndustryFilters
        industries={industries}
        active={activeIndustry}
        onSelect={setActiveIndustry}
      />

      {showSampleBadge && (
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px] rounded-lg p-3 text-xs flex items-center gap-2"
               style={{ background: P.amberSoft, color: P.amberText }}
               data-testid="ip-sample-badge">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span><strong>Sample Data</strong> — Public intelligence engine coming soon. The dashboard below is populated with realistic sample data across all industries so we can validate flows before the Phase 2 crawler goes live.</span>
          </div>
          <Link
            to={`/ecosystem/industry-pulse/compare?industryA=${encodeURIComponent(activeIndustry)}&industryB=${activeIndustry === "Financial Services" ? "Healthcare" : "Financial Services"}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap"
            style={{ background: P.navy, color: "#fff" }}
            data-testid="ip-compare-cta"
          >
            <GitCompare className="w-4 h-4" /> Compare industries
          </Link>
        </div>
      )}

      <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 lg:py-8 space-y-6">
        {loading && !payload && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm" style={{ color: P.muted, border: `1px solid ${P.line}` }}>
            Loading industry intelligence…
          </div>
        )}

        {payload && (
          <>
            <IndustrySummary
              industry={payload.industry}
              description={payload.description}
              summary={payload.summary}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
              <ModuleAdoptionCard scores={payload.module_scores} />
              <div className="space-y-6">
                <HighDemandCard industry={payload.industry} items={payload.high_demand_modules} />
                <StillAdoptingCard industry={payload.industry} items={payload.still_adopting} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <TopTrendsCard industry={payload.industry} trends={payload.top_trends} />
              <RecentGoLivesCard goLives={payload.recent_go_lives} />
              <TopHiringRolesCard roles={payload.top_hiring_roles} />
              <UpcomingEventsCard events={payload.upcoming_events} />
            </div>

            <div className="rounded-lg p-4 text-xs flex items-start gap-2"
                 style={{ background: "#F1F5F9", color: P.sub, border: `1px solid ${P.line}` }}
                 data-testid="ip-disclaimer">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{payload.disclaimer}</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

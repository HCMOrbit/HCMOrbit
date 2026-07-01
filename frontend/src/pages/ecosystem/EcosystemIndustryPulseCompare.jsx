/**
 * Industry Pulse — Compare view (/ecosystem/industry-pulse/compare).
 * Two-industry side-by-side comparison. All data from
 *   GET /api/intel/industry-pulse/compare?industryA=…&industryB=…
 * No hardcoded frontend data.
 */
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Circle, Info, Sparkles,
  BarChart3, Building2, Landmark, Store, Cpu, Factory, GraduationCap,
  Briefcase, Gavel, Users, Flame, Banknote, Shield, Clock, Plug, Code, Share2,
} from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { api } from "../../lib/api";

const P = {
  navy: "#0A1628", navyDark: "#050D1B",
  teal: "#0D9373", tealLight: "#1DB589",
  amber: "#F5B731",
  ink: "#0F172A", sub: "#475569", muted: "#94A3B8",
  line: "#E2E8F0", page: "#F8FAFC", card: "#FFFFFF",
  redSoft: "#FEE2E2", redText: "#B91C1C",
  amberSoft: "#FEF3C7", amberText: "#92400E",
  blueSoft: "#DBEAFE", blueText: "#1E40AF",
  greenSoft: "#DCFCE7", greenText: "#166534",
  slateSoft: "#F1F5F9", slateText: "#475569",
  // Two industry accents used across the comparison
  aColor: "#0D9373",    // teal — industry A
  aSoft:  "rgba(13, 147, 115, 0.14)",
  bColor: "#6366F1",    // indigo — industry B
  bSoft:  "rgba(99, 102, 241, 0.14)",
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
  sparkles: Sparkles, banknote: Banknote, shield: Shield, users: Users,
  clock: Clock, plug: Plug, chart: BarChart3, code: Code, gavel: Gavel,
  building: Building2,
};

const DEMAND_STYLE = {
  "Very High": { bg: P.redSoft, fg: P.redText },
  "High":      { bg: P.amberSoft, fg: P.amberText },
  "Medium":    { bg: P.blueSoft, fg: P.blueText },
  "Emerging":  { bg: P.slateSoft, fg: P.slateText },
  "Low":       { bg: P.slateSoft, fg: P.slateText },
};

function Chip({ children, bg, fg, testId }) {
  return (
    <span data-testid={testId} style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: bg, color: fg, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}
function DemandChip({ level }) {
  const s = DEMAND_STYLE[level] || DEMAND_STYLE.Medium;
  return <Chip bg={s.bg} fg={s.fg}>{level}</Chip>;
}

// Delta badge — shows "Higher in A", "Higher in B", or "Similar"
function DeltaBadge({ higher, delta, nameA, nameB }) {
  if (higher === "similar") {
    return <Chip bg={P.slateSoft} fg={P.slateText}>Similar</Chip>;
  }
  const label = higher === "A" ? nameA : nameB;
  const color = higher === "A" ? P.aColor : P.bColor;
  const soft = higher === "A" ? P.aSoft : P.bSoft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: soft, color: color, whiteSpace: "nowrap",
    }}>
      <ArrowUp className="w-3 h-3" />
      {label} +{delta}pt
    </span>
  );
}

// ---------- Hero -------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden"
             style={{ background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDark} 100%)`, color: "#fff" }}
             data-testid="cmp-hero">
      <svg aria-hidden className="pointer-events-none absolute right-0 top-6 opacity-40 hidden md:block"
           width="580" height="280" viewBox="0 0 580 280" fill="none">
        <defs>
          <linearGradient id="cmpLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={P.teal} stopOpacity="0.05" />
            <stop offset="1" stopColor={P.teal} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path d="M0,220 L80,210 L160,190 L240,170 L320,140 L400,110 L480,80 L580,40"
              stroke="url(#cmpLine)" strokeWidth="2" fill="none" />
        <path d="M0,240 L80,230 L160,220 L240,200 L320,180 L400,160 L480,140 L580,120"
              stroke={P.bColor} strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-12 pb-12 relative">
        <nav className="text-xs mb-5 text-white/60" data-testid="cmp-breadcrumb">
          <a href="/" className="hover:text-white/90">Home</a>
          <span className="mx-2">›</span>
          <a href="/ecosystem/industry-pulse" className="hover:text-white/90" style={{ color: P.tealLight }}>Ecosystem</a>
          <span className="mx-2">›</span>
          <a href="/ecosystem/industry-pulse" className="hover:text-white/90" style={{ color: P.tealLight }}>Industry Pulse</a>
          <span className="mx-2">›</span>
          <span className="text-white/90">Compare</span>
        </nav>
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: P.tealLight }}>
          Industry Pulse · Compare
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-bold leading-[1.08] mb-4 max-w-3xl">
          Compare industries side-by-side
        </h1>
        <p className="text-white/70 text-base max-w-2xl leading-relaxed">
          Pick two industries to see how Workday module adoption, demand, and adoption opportunities differ across them.
        </p>
      </div>
    </section>
  );
}

// ---------- Industry selector row -------------------------------------------
function IndustrySelector({ label, value, options, onChange, color, testId }) {
  const Icon = INDUSTRY_ICONS[value] || Building2;
  return (
    <div className="flex-1 rounded-xl bg-white p-4" style={{ border: `1px solid ${P.line}` }} data-testid={testId}>
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: color }}>{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: color === P.aColor ? P.aSoft : P.bSoft }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border rounded-md px-2 py-2 text-sm font-semibold"
          style={{ borderColor: P.line, color: P.ink }}
          data-testid={`${testId}-select`}
        >
          {options.map((ind) => <option key={ind.name} value={ind.name}>{ind.name}</option>)}
        </select>
      </div>
    </div>
  );
}

// ---------- Module comparison chart -----------------------------------------
// Two rows per module: A on top, B below. Each row is a stacked bar
// (high / adopting / early). Similar visual to the main dashboard but
// halved height for a denser side-by-side read.
function StackedBar({ h, a, e, color, faded }) {
  return (
    <div className="flex items-center overflow-hidden rounded-full h-5 w-full" style={{ background: P.slateSoft, opacity: faded ? 0.9 : 1 }}>
      <div style={{ width: `${h}%`, background: color, height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: h > 10 ? 6 : 0, color: "#fff", fontSize: 10, fontWeight: 700,
                    borderRadius: "999px 0 0 999px" }}>{h > 10 ? `${h}%` : ""}</div>
      <div style={{ width: `${a}%`, background: P.amber, height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: a > 10 ? 6 : 0, color: "#fff", fontSize: 10, fontWeight: 700 }}>{a > 10 ? `${a}%` : ""}</div>
      <div style={{ width: `${e}%`, background: "#CBD5E1", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: e > 10 ? 6 : 0, color: P.slateText, fontSize: 10, fontWeight: 700,
                    borderRadius: "0 999px 999px 0" }}>{e > 10 ? `${e}%` : ""}</div>
    </div>
  );
}

function ComparisonModuleRow({ delta, nameA, nameB }) {
  const rowStyle = "grid grid-cols-[160px_1fr_120px] items-center gap-3 py-2";
  return (
    <div style={{ borderTop: `1px solid ${P.line}`, padding: "10px 0" }} data-testid={`cmp-module-${delta.module.replace(/\s+/g, "-").replace(/\//g, "-").toLowerCase()}`}>
      <div className={rowStyle}>
        <div className="text-sm font-semibold" style={{ color: P.ink }}>{delta.module}</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold w-3" style={{ color: P.aColor }}>A</span>
            <StackedBar h={delta.a_high} a={delta.a_adopting} e={delta.a_early} color={P.aColor} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold w-3" style={{ color: P.bColor }}>B</span>
            <StackedBar h={delta.b_high} a={delta.b_adopting} e={delta.b_early} color={P.bColor} />
          </div>
        </div>
        <div className="flex justify-end">
          <DeltaBadge higher={delta.higher} delta={delta.delta} nameA={nameA} nameB={nameB} />
        </div>
      </div>
    </div>
  );
}

function ModuleComparisonCard({ deltas, nameA, nameB }) {
  return (
    <div className="rounded-2xl bg-white p-6" style={{ border: `1px solid ${P.line}` }} data-testid="cmp-module-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: P.ink }}>Module adoption comparison</h3>
          <p className="text-xs" style={{ color: P.sub }}>All 14 modules — <span style={{ color: P.aColor, fontWeight: 700 }}>A: {nameA}</span> vs <span style={{ color: P.bColor, fontWeight: 700 }}>B: {nameB}</span></p>
        </div>
        <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: P.sub }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: P.aColor }} />{nameA}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: P.bColor }} />{nameB}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: P.amber }} />Adopting</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#CBD5E1" }} />Early</span>
        </div>
      </div>
      <div className="mt-3">
        {deltas.map((d) => <ComparisonModuleRow key={d.module} delta={d} nameA={nameA} nameB={nameB} />)}
      </div>
    </div>
  );
}

// ---------- HCMOrbit Insight strip -------------------------------------------
function InsightCard({ insight }) {
  return (
    <div className="rounded-2xl p-6" style={{
      background: `linear-gradient(135deg, ${P.navy} 0%, ${P.navyDark} 100%)`,
      color: "#fff",
    }} data-testid="cmp-insight-card">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
             style={{ background: "rgba(29, 181, 137, 0.15)" }}>
          <Sparkles className="w-5 h-5" style={{ color: P.tealLight }} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-1.5" style={{ color: P.tealLight }}>HCMOrbit Insight</div>
          <p className="text-sm leading-relaxed text-white/85">{insight}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Comparative small cards -----------------------------------------
function CompareTwoCol({ title, subtitle, testId, aTitle, aItems, bTitle, bItems, renderItem, empty }) {
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}` }} data-testid={testId}>
      <h3 className="text-base font-bold mb-1" style={{ color: P.ink }}>{title}</h3>
      <p className="text-xs mb-4" style={{ color: P.sub }}>{subtitle}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold mb-2" style={{ color: P.aColor }}>{aTitle}</div>
          <div className="space-y-2">
            {aItems.length === 0 ? <div className="text-xs" style={{ color: P.muted }}>{empty}</div>
              : aItems.map((it, i) => renderItem(it, i, "A"))}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold mb-2" style={{ color: P.bColor }}>{bTitle}</div>
          <div className="space-y-2">
            {bItems.length === 0 ? <div className="text-xs" style={{ color: P.muted }}>{empty}</div>
              : bItems.map((it, i) => renderItem(it, i, "B"))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page --------------------------------------------------------
export default function EcosystemIndustryPulseCompare() {
  const [industries, setIndustries] = useState([]);
  const [params, setParams] = useSearchParams();
  const initialA = params.get("industryA") || "Healthcare";
  const initialB = params.get("industryB") || "Financial Services";
  const [industryA, setIndustryA] = useState(initialA);
  const [industryB, setIndustryB] = useState(initialB);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/intel/industries").then((r) => setIndustries(r.data.industries || []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Also update URL so the comparison is shareable
    setParams({ industryA, industryB }, { replace: true });
    api.get(`/intel/industry-pulse/compare?industryA=${encodeURIComponent(industryA)}&industryB=${encodeURIComponent(industryB)}`)
      .then((r) => { if (!cancelled) { setPayload(r.data); setLoading(false); } })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.response?.data?.detail || "Unable to load comparison");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [industryA, industryB, setParams]);

  const swap = () => { const a = industryA; setIndustryA(industryB); setIndustryB(a); };

  const shareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback: hidden textarea + document.execCommand (older browsers / insecure contexts)
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand copy failed");
      }
      toast.success("Comparison link copied");
    } catch (e) {
      toast.error("Could not copy link");
    }
  };

  const A = payload?.industryA;
  const B = payload?.industryB;
  const nameA = A?.industry || industryA;
  const nameB = B?.industry || industryB;

  return (
    <div style={{ background: P.page, minHeight: "100vh" }}>
      <NavHeader />
      <Hero />

      {/* Selectors */}
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 -mt-6 relative">
        <div className="flex items-center gap-3">
          <IndustrySelector
            label="Industry A"
            value={industryA}
            options={industries.filter((i) => i.name !== industryB)}
            onChange={setIndustryA}
            color={P.aColor}
            testId="cmp-selector-a"
          />
          <button onClick={swap} className="hidden md:flex items-center justify-center w-11 h-11 rounded-full bg-white border shadow-sm"
                  style={{ borderColor: P.line, color: P.sub }} title="Swap A/B" data-testid="cmp-swap">
            <ArrowRight className="w-4 h-4" />
          </button>
          <IndustrySelector
            label="Industry B"
            value={industryB}
            options={industries.filter((i) => i.name !== industryA)}
            onChange={setIndustryB}
            color={P.bColor}
            testId="cmp-selector-b"
          />
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Link to="/ecosystem/industry-pulse"
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: P.sub }} data-testid="cmp-back-link">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Industry Pulse
          </Link>
          <button
            onClick={shareLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition"
            style={{ background: P.navy, color: "#fff", border: "none", cursor: "pointer" }}
            data-testid="cmp-share-btn"
            title="Copy link to this comparison"
          >
            <Share2 className="w-3.5 h-3.5" /> Share this comparison
          </button>
          {payload?.is_sample_data && (
            <div className="ml-auto rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5"
                 style={{ background: P.amberSoft, color: P.amberText }} data-testid="cmp-sample-badge">
              <Info className="w-3.5 h-3.5" /><strong>Sample Data</strong> — Public intelligence engine coming soon
            </div>
          )}
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 lg:py-8 space-y-6">
        {loading && !payload && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm" style={{ color: P.muted, border: `1px solid ${P.line}` }}>
            Loading comparison…
          </div>
        )}
        {error && !loading && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm" style={{ color: P.redText, border: `1px solid ${P.line}` }} data-testid="cmp-error">
            {error}
          </div>
        )}

        {payload && (
          <>
            {/* Summary side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="cmp-summary-row">
              <IndustrySummaryMini payload={A} color={P.aColor} soft={P.aSoft} />
              <IndustrySummaryMini payload={B} color={P.bColor} soft={P.bSoft} />
            </div>

            {/* Module comparison chart */}
            <ModuleComparisonCard deltas={payload.module_deltas} nameA={nameA} nameB={nameB} />

            {/* HCMOrbit insight */}
            <InsightCard insight={payload.insight} />

            {/* Three comparison cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CompareTwoCol
                title="Still-adopting modules"
                subtitle="Modules with significant early-stage room in each industry"
                testId="cmp-still-adopting-card"
                aTitle={nameA}
                aItems={A.still_adopting}
                bTitle={nameB}
                bItems={B.still_adopting}
                empty="All modules broadly adopted."
                renderItem={(it, i) => (
                  <div key={it.module} className="flex items-center justify-between text-sm" data-testid={`cmp-still-adopting-item-${i}`}>
                    <span style={{ color: P.ink }}>{it.rank}. {it.module}</span>
                    <Chip
                      bg={it.stage === "Early Stage" ? P.blueSoft : P.amberSoft}
                      fg={it.stage === "Early Stage" ? P.blueText : P.amberText}
                    >
                      {it.stage}
                    </Chip>
                  </div>
                )}
              />
              <CompareTwoCol
                title="Top hiring roles"
                subtitle="Most in-demand Workday roles per industry"
                testId="cmp-hiring-card"
                aTitle={nameA}
                aItems={A.top_hiring_roles.slice(0, 5)}
                bTitle={nameB}
                bItems={B.top_hiring_roles.slice(0, 5)}
                empty="No hiring signal."
                renderItem={(it, i) => (
                  <div key={it.id || i} className="flex items-center justify-between text-sm gap-2" data-testid={`cmp-hiring-item-${i}`}>
                    <span className="truncate" style={{ color: P.ink }}>{it.role}</span>
                    <DemandChip level={it.demand_level} />
                  </div>
                )}
              />
              <CompareTwoCol
                title="Top trends"
                subtitle="Signals driving industry investment"
                testId="cmp-trends-card"
                aTitle={nameA}
                aItems={A.top_trends}
                bTitle={nameB}
                bItems={B.top_trends}
                empty="No trends tracked."
                renderItem={(it, i) => {
                  const Icon = TREND_ICON_MAP[it.icon] || Sparkles;
                  return (
                    <div key={it.id || i} className="flex items-start gap-2 text-sm" data-testid={`cmp-trend-item-${i}`}>
                      <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center mt-0.5"
                           style={{ background: P.slateSoft }}>
                        <Icon className="w-3 h-3" style={{ color: P.sub }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: P.ink }}>{it.title}</div>
                        <div className="text-xs leading-snug" style={{ color: P.sub }}>{it.description}</div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>

            {/* Disclaimer */}
            <div className="rounded-lg p-4 text-xs flex items-start gap-2"
                 style={{ background: "#F1F5F9", color: P.sub, border: `1px solid ${P.line}` }}
                 data-testid="cmp-disclaimer">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{payload.disclaimer}</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---------- Summary mini card (one industry) --------------------------------
function IndustrySummaryMini({ payload, color, soft }) {
  const Icon = INDUSTRY_ICONS[payload.industry] || Building2;
  return (
    <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${P.line}`, borderTop: `3px solid ${color}` }}
         data-testid={`cmp-summary-${payload.industry.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: soft }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color }}>Industry</div>
          <h3 className="text-xl font-bold" style={{ color: P.ink }}>{payload.industry}</h3>
        </div>
      </div>
      <p className="text-xs mb-4" style={{ color: P.sub }}>{payload.description}</p>
      <div className="grid grid-cols-2 gap-3">
        <SmallStat label="Hiring demand" value={payload.summary.hiring_demand} />
        <SmallStat label="Job postings" value={payload.summary.active_job_postings.toLocaleString()} />
        <SmallStat label="Customer go-lives" value={payload.summary.customer_go_lives_count} />
        <SmallStat label="Adoption trend" value={payload.summary.adoption_trend} />
      </div>
    </div>
  );
}
function SmallStat({ label, value }) {
  return (
    <div className="rounded-lg p-3" style={{ background: P.slateSoft }}>
      <div className="text-[11px]" style={{ color: P.sub }}>{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color: P.ink }}>{value}</div>
    </div>
  );
}

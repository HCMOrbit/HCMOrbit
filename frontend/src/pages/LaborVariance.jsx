import React, { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import NavHeader from "../components/NavHeader";

/* ─── Design tokens ────────────────────────────────────────────────────────
   Applied as CSS custom properties inside `.lv-root` so nothing else in the
   app inherits them. Colors and fonts are page-scoped. */
const TOKENS_CSS = `
.lv-root {
  --ink: #0F1E29;
  --paper: #F7F8F6;
  --card: #FFFFFF;
  --line: #D8DDD9;
  --neutral: #5F7280;
  --favorable: #1F6E5C;
  --unfavorable: #A5321F;
  --amber: #FBF4E8;

  --heading-font: "Archivo", ui-sans-serif, system-ui, sans-serif;
  --body-font: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --mono-font: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  background: var(--paper);
  color: var(--ink);
  font-family: var(--body-font);
  font-size: 16px;
  line-height: 1.55;
}

/* ─── Reset within the page only ────────────────────────────────────────── */
.lv-root, .lv-root * { box-sizing: border-box; }
.lv-root p { margin: 0; }
.lv-root a { color: inherit; text-decoration: none; }
.lv-root :focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

/* ─── Eyebrow ─────────────────────────────────────────────────────────── */
.lv-eyebrow {
  font-family: var(--mono-font);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--neutral);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.lv-eyebrow::before { content: "—"; color: var(--neutral); }

/* Chart SVG stays legible on narrow screens — allow horizontal scroll below
   a min-width rather than shrinking labels to unreadable sizes. */
.lv-chart-svg-wrap { width: 100%; overflow-x: auto; overflow-y: hidden; }
.lv-chart-svg { display: block; height: auto; min-width: 620px; width: 100%; }

/* ─── Layout containers ───────────────────────────────────────────────── */
.lv-wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
@media (max-width: 640px) { .lv-wrap { padding: 0 20px; } }

/* ─── Hero chart card ─────────────────────────────────────────────────── */
.lv-chart-card {
  background: var(--card);
  border: 1px solid var(--line);
  padding: 40px 40px 32px;
  margin: 44px 0 96px;
}
@media (max-width: 720px) { .lv-chart-card { padding: 28px 20px 22px; } }
.lv-chart-title {
  font-family: var(--heading-font);
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 4px;
}
.lv-chart-subtitle {
  font-family: var(--mono-font);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--neutral);
  margin-bottom: 24px;
}

/* Waterfall bars — scaleY(0) → scaleY(1) from bottom, staggered. */
.lv-bar {
  transform-box: fill-box;
  transform-origin: bottom;
  transform: scaleY(0);
  animation: lv-grow 620ms cubic-bezier(0.22, 0.7, 0.28, 1) forwards;
}
@keyframes lv-grow { to { transform: scaleY(1); } }
.lv-connector {
  stroke-dasharray: 4 4;
  stroke: var(--neutral);
  stroke-width: 1;
  opacity: 0;
  animation: lv-fade 500ms ease forwards;
}
@keyframes lv-fade { to { opacity: 0.7; } }
.lv-bar-value {
  font-family: var(--mono-font);
  font-size: 11.5px;
  font-weight: 500;
  fill: var(--ink);
  opacity: 0;
  animation: lv-fade-1 380ms ease forwards;
}
@keyframes lv-fade-1 { to { opacity: 1; } }
.lv-bar-label {
  font-family: var(--mono-font);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  fill: var(--neutral);
}
.lv-axis {
  stroke: var(--line);
  stroke-width: 1;
}

.lv-chart-legend {
  margin-top: 22px;
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.lv-legend-items { display: flex; gap: 22px; flex-wrap: wrap; }
.lv-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono-font);
  font-size: 11.5px;
  color: var(--ink);
  letter-spacing: 0.02em;
}
.lv-legend-swatch {
  width: 12px; height: 12px;
  border: 1px solid var(--ink);
  display: inline-block;
}
.lv-legend-gap {
  font-family: var(--mono-font);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}
.lv-legend-gap-em { color: var(--unfavorable); font-weight: 700; }
.lv-chart-foot {
  margin-top: 16px;
  font-family: var(--mono-font);
  font-size: 11px;
  color: var(--neutral);
  letter-spacing: 0.01em;
}

/* ─── Section shell ───────────────────────────────────────────────────── */
.lv-section { padding: 88px 0; border-top: 1px solid var(--line); }
.lv-section h2 {
  font-family: var(--heading-font);
  font-weight: 800;
  color: var(--ink);
  line-height: 1.15;
  letter-spacing: -0.005em;
  font-size: clamp(30px, 4vw, 42px);
  margin: 18px 0 18px;
  max-width: 900px;
}
.lv-section-sub {
  font-size: 17px;
  line-height: 1.6;
  color: var(--ink);
  max-width: 780px;
  margin-bottom: 40px;
}

/* ─── Problem cards ───────────────────────────────────────────────────── */
.lv-q-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 900px) { .lv-q-grid { grid-template-columns: 1fr; } }
.lv-q-card {
  background: var(--card);
  border: 1px solid var(--line);
  padding: 28px 26px;
}
.lv-q-label {
  font-family: var(--mono-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--unfavorable);
  margin-bottom: 14px;
  display: block;
}
.lv-q-text {
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink);
}

/* ─── Methodology ledger ──────────────────────────────────────────────── */
.lv-ledger {
  background: var(--card);
  border: 1px solid var(--line);
}
.lv-ledger-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px;
  gap: 24px;
  padding: 28px 32px;
  border-bottom: 1px solid var(--line);
  align-items: start;
}
.lv-ledger-row:last-child { border-bottom: 0; }
@media (max-width: 720px) {
  .lv-ledger-row {
    grid-template-columns: 40px 1fr;
    padding: 22px 20px;
    gap: 14px;
  }
  .lv-ledger-pill-cell { grid-column: 2; margin-top: 10px; }
}
.lv-ledger-num {
  font-family: var(--mono-font);
  font-size: 13px;
  font-weight: 600;
  color: var(--neutral);
  letter-spacing: 0.05em;
}
.lv-ledger-name {
  font-family: var(--heading-font);
  font-size: 19px;
  font-weight: 800;
  margin-bottom: 6px;
  color: var(--ink);
}
.lv-ledger-desc {
  font-size: 15px;
  color: var(--ink);
  line-height: 1.55;
}
.lv-pill {
  font-family: var(--mono-font);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 6px 12px;
  border: 1px solid currentColor;
  display: inline-block;
  white-space: nowrap;
}
.lv-pill--just { color: var(--favorable); }
.lv-pill--act { color: var(--unfavorable); }
.lv-ledger-pill-cell { text-align: right; }
@media (max-width: 720px) { .lv-ledger-pill-cell { text-align: left; } }

/* ─── How it works ────────────────────────────────────────────────────── */
.lv-how-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 1024px) { .lv-how-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .lv-how-grid { grid-template-columns: 1fr; } }
.lv-how-card {
  background: var(--card);
  border: 1px solid var(--line);
  padding: 26px 24px;
}
.lv-how-week {
  font-family: var(--mono-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--favorable);
  margin-bottom: 14px;
  display: block;
}
.lv-how-title {
  font-family: var(--heading-font);
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 10px;
  line-height: 1.25;
}
.lv-how-text {
  font-size: 14.5px;
  color: var(--ink);
  line-height: 1.55;
}

.lv-amber-panel {
  background: var(--amber);
  border: 1px solid #E8DEC2;
  padding: 34px 36px;
  margin-top: 40px;
}
@media (max-width: 640px) { .lv-amber-panel { padding: 26px 20px; } }
.lv-amber-title {
  font-family: var(--mono-font);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink);
  margin-bottom: 20px;
}
.lv-amber-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 40px;
  list-style: none;
  padding: 0;
  margin: 0 0 22px;
}
@media (max-width: 720px) { .lv-amber-list { grid-template-columns: 1fr; } }
.lv-amber-list li {
  font-size: 15px;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.lv-amber-list li::before {
  content: "→";
  font-family: var(--mono-font);
  color: var(--favorable);
  font-weight: 600;
}
.lv-amber-note {
  font-family: var(--mono-font);
  font-size: 12.5px;
  color: var(--neutral);
  letter-spacing: 0.01em;
  line-height: 1.55;
}

/* ─── Deliverables ────────────────────────────────────────────────────── */
.lv-deliv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 900px) { .lv-deliv-grid { grid-template-columns: 1fr; } }
.lv-deliv-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-top-width: 4px;
  padding: 30px 26px;
}
.lv-deliv-card--green { border-top-color: var(--favorable); }
.lv-deliv-card--ink { border-top-color: var(--ink); }
.lv-deliv-num {
  font-family: var(--mono-font);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--neutral);
  margin-bottom: 14px;
  display: block;
}
.lv-deliv-name {
  font-family: var(--heading-font);
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 12px;
  line-height: 1.25;
}
.lv-deliv-text { font-size: 15px; line-height: 1.55; }

/* ─── About ───────────────────────────────────────────────────────────── */
.lv-about-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 56px;
  align-items: start;
}
@media (max-width: 900px) { .lv-about-grid { grid-template-columns: 1fr; gap: 32px; } }
.lv-about-text p { font-size: 16.5px; line-height: 1.65; margin-bottom: 18px; }
.lv-intersection {
  background: var(--ink);
  color: var(--paper);
  padding: 34px 30px;
}
.lv-intersection-title {
  font-family: var(--mono-font);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 22px;
  color: var(--paper);
}
.lv-int-list { list-style: none; padding: 0; margin: 0; }
.lv-int-list li {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(216, 221, 217, 0.14);
  align-items: baseline;
}
.lv-int-list li:last-child { border-bottom: 0; }
.lv-int-prefix {
  font-family: var(--mono-font);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #63B99C;
}
.lv-int-text { font-size: 14.5px; line-height: 1.5; color: var(--paper); }
.lv-int-text b { font-weight: 600; }

/* ─── Contact ─────────────────────────────────────────────────────────── */
.lv-contact {
  background: var(--ink);
  color: var(--paper);
}
.lv-contact .lv-eyebrow { color: rgba(247, 248, 246, 0.65); }
.lv-contact .lv-eyebrow::before { color: rgba(247, 248, 246, 0.65); }
.lv-contact h2 { color: var(--paper); }
.lv-contact-sub {
  font-size: 17.5px;
  line-height: 1.6;
  color: rgba(247, 248, 246, 0.85);
  max-width: 720px;
  margin-bottom: 34px;
}
.lv-contact-fine {
  font-family: var(--mono-font);
  font-size: 12px;
  letter-spacing: 0.03em;
  color: rgba(247, 248, 246, 0.55);
  margin-top: 22px;
}

/* ─── Fade-up on scroll ───────────────────────────────────────────────── */
.lv-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 620ms ease, transform 620ms cubic-bezier(0.22, 0.7, 0.28, 1);
  will-change: opacity, transform;
}
.lv-reveal.lv-in { opacity: 1; transform: none; }

/* ─── Reduced motion ──────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .lv-root .lv-bar,
  .lv-root .lv-connector,
  .lv-root .lv-bar-value {
    animation: none !important;
    transform: none !important;
    opacity: 1 !important;
  }
  .lv-root .lv-reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .lv-root { scroll-behavior: auto; }
}
`;

/* ─── Waterfall geometry ──────────────────────────────────────────────────
   viewBox 900x460. Baseline at y=380 (bar bottoms). Scale spans $0–$47M so
   the delta bars retain visible height (each $1M ≈ 7.45 px). */
const CHART_W = 900;
const CHART_H = 460;
const BASELINE_Y = 380;
const CHART_TOP_Y = 35;
const Y_MAX = 47; // $M
const PX_PER_M = (BASELINE_Y - CHART_TOP_Y) / Y_MAX; // ≈ 7.34

const BAR_LEFT = 60;
const BAR_RIGHT_PAD = 40;
const BAR_GAP = 15;
const BAR_COUNT = 7;
const BAR_W = (CHART_W - BAR_LEFT - BAR_RIGHT_PAD - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

const y = (v) => BASELINE_Y - v * PX_PER_M;

/* Bars — running totals track cumulative $M as we walk left→right. */
const BARS = [
  { key: "benchmark", label: "BENCHMARK", value: "$42.0M", bottom: 0, top: 42, color: "#5F7280", kind: "full" },
  { key: "acuity", label: "ACUITY", value: "+$1.6M", bottom: 42, top: 43.6, color: "#1F6E5C", kind: "delta" },
  { key: "staffing", label: "STAFFING EFF.", value: "+$0.9M", bottom: 43.6, top: 44.5, color: "#A5321F", kind: "delta" },
  { key: "skill", label: "SKILL MIX", value: "+$0.4M", bottom: 44.5, top: 44.9, color: "#A5321F", kind: "delta" },
  { key: "ot", label: "OT PREM.", value: "+$0.5M", bottom: 44.9, top: 45.4, color: "#A5321F", kind: "delta" },
  { key: "agency", label: "AGENCY", value: "+$0.8M", bottom: 45.4, top: 46.2, color: "#A5321F", kind: "delta" },
  { key: "actual", label: "ACTUAL", value: "$46.2M", bottom: 0, top: 46.2, color: "#0F1E29", kind: "full" },
];

function VarianceBridgeSVG() {
  return (
    <div className="lv-chart-svg-wrap">
      <svg
        className="lv-chart-svg"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Variance Bridge waterfall: Premier benchmark $42.0M, plus acuity $1.6M, plus staffing efficiency $0.9M, plus skill mix $0.4M, plus overtime premium $0.5M, plus agency $0.8M, actual $46.2M."
      >
        {/* Baseline axis */}
        <line x1={BAR_LEFT - 20} y1={BASELINE_Y} x2={CHART_W - BAR_RIGHT_PAD + 20} y2={BASELINE_Y} className="lv-axis" />

        {/* Connectors: dashed horizontal at the shared value between bar N (top) and bar N+1 (bottom). */}
        {BARS.slice(0, -1).map((b, i) => {
          const next = BARS[i + 1];
          const x1 = BAR_LEFT + i * (BAR_W + BAR_GAP) + BAR_W;
          const x2 = BAR_LEFT + (i + 1) * (BAR_W + BAR_GAP);
          // Connector sits at the value shared between the two: bar N top → bar N+1 bottom.
          // For the final full-height bar, use its top-of-value (46.2) instead of $0.
          const sharedVal =
            next.kind === "full" && next.key === "actual" ? next.top : next.bottom;
          const cy = y(sharedVal);
          const delayMs = 200 + i * 120;
          return (
            <line
              key={`c-${b.key}`}
              className="lv-connector"
              x1={x1}
              y1={cy}
              x2={x2}
              y2={cy}
              style={{ animationDelay: `${delayMs}ms` }}
            />
          );
        })}

        {/* Bars */}
        {BARS.map((b, i) => {
          const x = BAR_LEFT + i * (BAR_W + BAR_GAP);
          const yTop = y(b.top);
          const yBot = y(b.bottom);
          const h = Math.max(2, yBot - yTop); // min visible height for tiny deltas
          const delayMs = i * 110;
          return (
            <g key={b.key}>
              <rect
                className="lv-bar"
                x={x}
                y={yTop}
                width={BAR_W}
                height={h}
                fill={b.color}
                style={{ animationDelay: `${delayMs}ms` }}
              />
              {/* Value label above segment */}
              <text
                className="lv-bar-value"
                x={x + BAR_W / 2}
                y={yTop - 10}
                textAnchor="middle"
                style={{ animationDelay: `${delayMs + 500}ms` }}
              >
                {b.value}
              </text>
              {/* Category label below axis */}
              <text
                className="lv-bar-label"
                x={x + BAR_W / 2}
                y={BASELINE_Y + 20}
                textAnchor="middle"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Small ledger row ────────────────────────────────────────────────── */
function LedgerRow({ n, name, desc, tag }) {
  const pillClass = tag === "JUSTIFIED" ? "lv-pill--just" : "lv-pill--act";
  return (
    <div className="lv-ledger-row">
      <div className="lv-ledger-num">D{n}</div>
      <div>
        <div className="lv-ledger-name">{name}</div>
        <div className="lv-ledger-desc">{desc}</div>
      </div>
      <div className="lv-ledger-pill-cell">
        <span className={`lv-pill ${pillClass}`}>{tag}</span>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function LaborVariance() {
  const rootRef = useRef(null);

  // Document title + meta description (page-scoped, restored on unmount).
  useEffect(() => {
    const prevTitle = document.title;
    document.title =
      "Labor Variance Assessment — decompose your gap vs. Premier benchmark | HCMOrbit";
    const desc =
      "A fixed-scope diagnostic for hospital finance leaders. Decomposes the labor cost gap vs. Premier benchmark into acuity-justified and five actionable drivers — built from UKG, Premier, Epic, and Workday data.";
    let meta = document.querySelector('meta[name="description"]');
    let created = false;
    const prevDesc = meta ? meta.getAttribute("content") : null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
      created = true;
    }
    meta.setAttribute("content", desc);
    return () => {
      document.title = prevTitle;
      if (created && meta.parentNode) meta.parentNode.removeChild(meta);
      else if (meta && prevDesc !== null) meta.setAttribute("content", prevDesc);
    };
  }, []);

  // Fade-up reveal on scroll — disabled under prefers-reduced-motion.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = rootRef.current
      ? rootRef.current.querySelectorAll(".lv-reveal")
      : [];
    if (reduce) {
      els.forEach((e) => e.classList.add("lv-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lv-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lv-root" ref={rootRef} data-testid="labor-variance-page">
      <style>{TOKENS_CSS}</style>
      <style>{`html { scroll-behavior: smooth; } .lv-root section[id] { scroll-margin-top: 80px; }`}</style>

      {/* ─── Shared site header ─── */}
      <NavHeader />

      {/* ─── Hero (site-styled: navy gradient card, amber eyebrow, teal accent) ─── */}
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-8" data-testid="lv-hero-wrap">
        <section
          id="top"
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
            borderRadius: 18,
            color: "#ffffff",
          }}
          data-testid="lv-hero"
        >
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-[#0D9373]/15 blur-[120px] pointer-events-none" />
          <div className="relative px-8 lg:px-10 py-12 lg:py-14">
            <div className="max-w-[900px]">
              <div
                data-testid="lv-hero-eyebrow"
                style={{
                  color: "#F5B731",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Labor Variance Assessment · For hospital finance leaders
              </div>
              <h1
                data-testid="lv-hero-h1"
                className="font-heading text-4xl sm:text-5xl lg:text-[52px] font-bold tracking-tight leading-[1.05]"
              >
                Premier says you&apos;re over benchmark.{" "}
                <span className="text-[#0D9373]">The board wants to know why.</span>
              </h1>
              <p className="mt-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed">
                A fixed-scope diagnostic that quantifies how much of your labor cost gap is
                justified by acuity and case mix — and decomposes the rest into five drivers
                your operators can actually act on. Built from the UKG, Premier, Epic, and
                Workday data you already have.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href="#contact"
                  data-testid="lv-hero-cta-primary"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium transition-colors"
                >
                  Scope a call <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#method"
                  data-testid="lv-hero-cta-secondary"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-white/30 hover:border-[#0D9373] hover:bg-white/5 text-white font-medium transition-colors"
                >
                  See the methodology
                </a>
              </div>
              <p className="mt-4 text-xs text-white/50 tracking-wide">
                4–6 weeks · Fixed fee · No new software to buy
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ─── Variance Bridge chart card (data artifact — untouched) ─── */}
      <div className="lv-wrap" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="lv-chart-card lv-reveal" data-testid="lv-chart-card">
            <h2 className="lv-chart-title">The Variance Bridge</h2>
            <p className="lv-chart-subtitle">
              Annualized labor cost · Illustrative multi-hospital system
            </p>
            <VarianceBridgeSVG />
            <div className="lv-chart-legend" data-testid="lv-chart-legend">
              <div className="lv-legend-items">
                <span className="lv-legend-item">
                  <span className="lv-legend-swatch" style={{ background: "#5F7280", borderColor: "#5F7280" }} />
                  Premier benchmark
                </span>
                <span className="lv-legend-item">
                  <span className="lv-legend-swatch" style={{ background: "#1F6E5C", borderColor: "#1F6E5C" }} />
                  Justified variance
                </span>
                <span className="lv-legend-item">
                  <span className="lv-legend-swatch" style={{ background: "#A5321F", borderColor: "#A5321F" }} />
                  Actionable variance
                </span>
              </div>
              <div className="lv-legend-gap">
                Gap: <span className="lv-legend-gap-em">$4.2M</span> · 38% justified
              </div>
            </div>
            <p className="lv-chart-foot">
              Figures are illustrative. Your bridge is built from your own UKG actuals,
              Premier cohort, and Epic census data.
            </p>
        </div>
      </div>

      {/* ─── Problem ─── */}
      <section className="lv-section">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">The problem</span>
            <h2>Your systems each tell half the story. Nobody reconciles them.</h2>
            <p className="lv-section-sub">
              UKG tells you your actuals. Premier tells you the cohort median. The number
              between them — the variance — lands on the CFO&apos;s desk with no
              explanation attached. And an unexplained variance always reads as an
              unjustified one.
            </p>
          </div>
          <div className="lv-q-grid lv-reveal">
            <div className="lv-q-card">
              <span className="lv-q-label">Q — Board meeting</span>
              <p className="lv-q-text">
                &ldquo;We&apos;re 10% over benchmark on nursing labor. How much of that is
                our patient population, and how much is us?&rdquo;
              </p>
            </div>
            <div className="lv-q-card">
              <span className="lv-q-label">Q — Budget season</span>
              <p className="lv-q-text">
                &ldquo;Finance wants a 6% labor reduction target. Which departments can
                absorb it — and which gaps are already acuity-justified?&rdquo;
              </p>
            </div>
            <div className="lv-q-card">
              <span className="lv-q-label">Q — Agency review</span>
              <p className="lv-q-text">
                &ldquo;Agency spend is up again. Is it a market problem, a scheduling
                problem, or a capability problem on specific units?&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Methodology ─── */}
      <section id="method" className="lv-section">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">The methodology</span>
            <h2>One gap. Five additive drivers. No double counting.</h2>
            <p className="lv-section-sub">
              The Variance Bridge decomposes the dollar gap between your actuals and your
              acuity-adjusted Premier benchmark into five mutually exclusive drivers. Each
              dollar is assigned once — so the bridge always reconciles, and every driver
              points to a specific owner and action.
            </p>
          </div>
          <div className="lv-ledger lv-reveal" data-testid="lv-ledger">
            <LedgerRow n={1} name="Acuity & case mix"
              desc="Variance explained by patient demand — census intensity, case mix, unit type. This portion of your gap is defensible, in writing."
              tag="JUSTIFIED" />
            <LedgerRow n={2} name="Staffing efficiency"
              desc="Hours deployed above target for the demand served — often traceable to capability gaps and single points of failure on specific units."
              tag="ACTIONABLE" />
            <LedgerRow n={3} name="Skill mix"
              desc="Cost of the license and role mix used versus the mix the work required."
              tag="ACTIONABLE" />
            <LedgerRow n={4} name="Overtime premium"
              desc="The premium portion of OT dollars — separated from the base hours so it isn't counted twice."
              tag="ACTIONABLE" />
            <LedgerRow n={5} name="Agency premium"
              desc="The premium paid above employed-labor cost for contract staff, by unit and job family."
              tag="ACTIONABLE" />
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how" className="lv-section">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">How it works</span>
            <h2>Four to six weeks. Your existing exports. A fixed fee.</h2>
          </div>
          <div className="lv-how-grid lv-reveal">
            <div className="lv-how-card">
              <span className="lv-how-week">Weeks 1–2</span>
              <div className="lv-how-title">Data intake &amp; validation</div>
              <p className="lv-how-text">
                You provide standard exports — no integrations, no IT project. We
                reconcile hours, dollars, and census across systems before any analysis
                begins.
              </p>
            </div>
            <div className="lv-how-card">
              <span className="lv-how-week">Weeks 2–4</span>
              <div className="lv-how-title">Bridge construction</div>
              <p className="lv-how-text">
                We build your Variance Bridge by entity, department, and job family —
                actuals vs. acuity-adjusted benchmark, decomposed into the five drivers.
              </p>
            </div>
            <div className="lv-how-card">
              <span className="lv-how-week">Weeks 4–5</span>
              <div className="lv-how-title">Root-cause tracing</div>
              <p className="lv-how-text">
                Actionable drivers are traced to their operational causes: capability
                gaps, scheduling patterns, premium labor dependency on specific units.
              </p>
            </div>
            <div className="lv-how-card">
              <span className="lv-how-week">Week 6</span>
              <div className="lv-how-title">Executive readout</div>
              <p className="lv-how-text">
                A board-ready presentation of the bridge, the justified percentage, and a
                sequenced remediation roadmap with owners and expected recapture.
              </p>
            </div>
          </div>

          <div className="lv-amber-panel lv-reveal" data-testid="lv-amber">
            <div className="lv-amber-title">What we need from you</div>
            <ul className="lv-amber-list">
              <li>UKG productivity &amp; timekeeping exports</li>
              <li>Premier benchmark / cohort reports</li>
              <li>Epic census &amp; ADT extracts</li>
              <li>Workday worker &amp; position data</li>
              <li>GL labor cost detail (or payroll register)</li>
              <li>Department-to-cost-center mapping</li>
            </ul>
            <p className="lv-amber-note">
              All standard exports your teams already produce. A one-hour working session
              with your decision support or WFM analyst covers the rest.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Deliverables ─── */}
      <section className="lv-section">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">What you get</span>
            <h2>Three artifacts, built to be forwarded.</h2>
          </div>
          <div className="lv-deliv-grid lv-reveal">
            <div className="lv-deliv-card lv-deliv-card--green">
              <span className="lv-deliv-num">Artifact 01</span>
              <div className="lv-deliv-name">The Variance Bridge</div>
              <p className="lv-deliv-text">
                Your gap, decomposed and reconciled to the dollar — by entity, department,
                and job family. The chart your CFO screenshots into the board deck.
              </p>
            </div>
            <div className="lv-deliv-card lv-deliv-card--ink">
              <span className="lv-deliv-num">Artifact 02</span>
              <div className="lv-deliv-name">Driver root-cause report</div>
              <p className="lv-deliv-text">
                For every actionable dollar: where it originates, which unit owns it, and
                what pattern in the data produced it.
              </p>
            </div>
            <div className="lv-deliv-card lv-deliv-card--ink">
              <span className="lv-deliv-num">Artifact 03</span>
              <div className="lv-deliv-name">Remediation roadmap</div>
              <p className="lv-deliv-text">
                A sequenced plan — quick recaptures first — with an owner, a mechanism,
                and an expected dollar range for each move.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── About ─── */}
      <section id="about" className="lv-section">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">Who&apos;s behind this</span>
            <h2>Built by someone who has sat on both sides of the variance.</h2>
          </div>
          <div className="lv-about-grid lv-reveal">
            <div className="lv-about-text">
              <p>
                Labor Variance is led by Suchi, founder of HCMOrbit — a Workday technical
                architect with 17+ years across HCM platforms, and hands-on healthcare
                workforce experience inside a multi-hospital regional health system:
                configuring UKG, reconciling Epic and Workday data, building productivity
                reporting for finance leadership, and supporting the transition from
                managed productivity services to an in-house model.
              </p>
              <p>
                The methodology exists because this exact question — &ldquo;how much of
                our gap is justified?&rdquo; — kept landing on desks with no tool built to
                answer it.
              </p>
            </div>
            <aside className="lv-intersection" data-testid="lv-intersection">
              <div className="lv-intersection-title">The intersection</div>
              <ul className="lv-int-list">
                <li>
                  <span className="lv-int-prefix">WD</span>
                  <span className="lv-int-text"><b>Workday</b> — workforce &amp; position foundation</span>
                </li>
                <li>
                  <span className="lv-int-prefix">UKG</span>
                  <span className="lv-int-text"><b>UKG</b> — labor deployment &amp; productivity</span>
                </li>
                <li>
                  <span className="lv-int-prefix">EP</span>
                  <span className="lv-int-text"><b>Epic</b> — patient demand &amp; census</span>
                </li>
                <li>
                  <span className="lv-int-prefix">PR</span>
                  <span className="lv-int-text"><b>Premier</b> — external benchmarking</span>
                </li>
                <li>
                  <span className="lv-int-prefix">FIN</span>
                  <span className="lv-int-text"><b>Hospital finance</b> &amp; decision support</span>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      {/* ─── Contact ─── */}
      <section id="contact" className="lv-section lv-contact">
        <div className="lv-wrap">
          <div className="lv-reveal">
            <span className="lv-eyebrow">Next step</span>
            <h2>Scope your assessment in one call.</h2>
            <p className="lv-contact-sub">
              Thirty minutes: your systems, your cohort, your departments in scope.
              You&apos;ll leave with a clear yes/no on fit and a fixed fee — before
              anything is signed.
            </p>
            <a
              href="mailto:hello@hcmorbit.com?subject=Labor%20Variance%20Assessment%20%E2%80%94%20scoping%20call"
              className="lv-btn lv-btn--onink"
              data-testid="lv-contact-cta"
            >
              Request a scoping call
            </a>
            <p className="lv-contact-fine">Fixed scope · Fixed fee · Typically 4–6 weeks</p>
          </div>
        </div>
      </section>
    </div>
  );
}

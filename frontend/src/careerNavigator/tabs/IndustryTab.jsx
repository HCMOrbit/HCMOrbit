import React, { useEffect, useRef, useState } from "react";
import {
  Hospital, GraduationCap, Landmark, ShoppingBag, Cpu, Building, Factory,
  FileText, Rocket, TrendingUp, Briefcase, ArrowRight, Sparkles,
} from "lucide-react";
import { INDUSTRIES, RECENT_GOLIVES, HEATING_UP } from "../data";

// Lucide icon per industry id (no icon tokens exist in data.js for industries
// yet — keep the mapping here so we don't need to touch /data.js).
const INDUSTRY_ICONS = {
  "healthcare": Hospital,
  "higher-ed": GraduationCap,
  "financial-services": Landmark,
  "retail": ShoppingBag,
  "technology": Cpu,
  "government": Building,
  "manufacturing": Factory,
};

// -------- Resting-style helper -----------------------------------------------
const setMatchTrackRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#0a1628", "important");
  el.style.setProperty("color", "#ffffff", "important");
  el.style.setProperty("border", "none", "important");
};
const setDemandRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "rgba(29,181,137,0.18)", "important");
  el.style.setProperty("color", "#0f6e56", "important");
  el.style.setProperty("border", "1px solid rgba(29,181,137,0.35)", "important");
};

// -------- Industry pills row -------------------------------------------------
function IndustryPills({ value, onChange }) {
  const refs = useRef({});
  useEffect(() => {
    INDUSTRIES.forEach((ind) => {
      const el = refs.current[ind.id];
      if (!el) return;
      if (ind.id === value) {
        el.style.setProperty("background", "#e7f7f1", "important");
        el.style.setProperty("color", "#0f6e56", "important");
        el.style.setProperty("border", "1px solid #c4ebdc", "important");
      } else {
        el.style.setProperty("background", "#ffffff", "important");
        el.style.setProperty("color", "#0d1b2a", "important");
        el.style.setProperty("border", "1px solid #eaeaea", "important");
      }
    });
  }, [value]);
  return (
    <div className="flex flex-wrap gap-2 mt-4" data-testid="career-industry-pills">
      {INDUSTRIES.map((ind) => {
        const Icon = INDUSTRY_ICONS[ind.id] || Building;
        return (
          <button
            key={ind.id}
            type="button"
            ref={(el) => { refs.current[ind.id] = el; }}
            onClick={() => onChange(ind.id)}
            data-testid={`career-industry-pill-${ind.id}`}
            className="inline-flex items-center gap-2 text-[12.5px] font-medium"
            style={{ padding: "6px 12px", borderRadius: 9999, cursor: "pointer" }}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{ind.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// -------- KB chip used inside the snapshot panel ----------------------------
function KBChip({ guide }) {
  const handleClick = () => { console.log("KB link:", guide.docId); };
  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={`career-industry-kb-${guide.docId}`}
      className="inline-flex items-center gap-2 text-[12.5px] font-medium"
      style={{
        background: "#ffffff",
        color: "#0d1b2a",
        border: "1px solid #d4ede4",
        borderRadius: 9999,
        padding: "5px 10px",
        cursor: "pointer",
      }}
    >
      <FileText className="w-3.5 h-3.5" style={{ color: "#1DB589" }} />
      <span>{guide.title}</span>
    </button>
  );
}

// -------- Snapshot panel -----------------------------------------------------
function SnapshotPanel({ industry, onPickTrack }) {
  const demandRef = useRef(null);
  useEffect(() => { setDemandRest(demandRef.current); }, []);
  const Icon = INDUSTRY_ICONS[industry.id] || Building;

  const isFull = !!industry.insight;
  if (!isFull) {
    return (
      <div
        className="mt-5 p-5"
        style={{ background: "#f1faf6", border: "1px solid #d4ede4", borderRadius: 12 }}
        data-testid="career-industry-snapshot-minimal"
      >
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 inline-flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 9999, background: "rgba(29,181,137,0.14)", color: "#0f6e56" }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-semibold flex-1" style={{ color: "#0d1b2a" }}>{industry.name}</h3>
          <span
            ref={demandRef}
            data-testid="career-industry-demand-badge"
            className="text-[11px] font-semibold"
            style={{ borderRadius: 9999, padding: "4px 10px" }}
          >
            DEMAND: {industry.demand}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-[13px]" style={{ color: "#0f6e56" }}>
          <Sparkles className="w-4 h-4" />
          Full snapshot coming soon
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-5 p-5"
      style={{ background: "#f1faf6", border: "1px solid #d4ede4", borderRadius: 12 }}
      data-testid="career-industry-snapshot-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="shrink-0 inline-flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 9999, background: "rgba(29,181,137,0.14)", color: "#0f6e56" }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-[15px] font-semibold flex-1" style={{ color: "#0d1b2a" }}>{industry.name}</h3>
        <span
          ref={demandRef}
          data-testid="career-industry-demand-badge"
          className="text-[11px] font-semibold"
          style={{ borderRadius: 9999, padding: "4px 10px" }}
        >
          DEMAND: {industry.demand}
        </span>
      </div>

      {/* Two columns */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div data-testid="career-industry-hot-modules">
          <div className="text-[10px] font-semibold mb-1.5" style={{ color: "#0f6e56", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Hot modules
          </div>
          <p className="text-[13px]" style={{ color: "#0d1b2a" }}>
            {industry.hotModules.length > 0 ? industry.hotModules.join(", ") : "—"}
          </p>
        </div>
        <div data-testid="career-industry-rising-role">
          <div className="text-[10px] font-semibold mb-1.5" style={{ color: "#0f6e56", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Rising role
          </div>
          <p className="text-[13px]" style={{ color: "#0d1b2a" }}>
            {industry.risingRole || "—"}
          </p>
        </div>
      </div>

      {/* Insight */}
      <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#3d4856" }}>
        {industry.insight}
      </p>

      {/* KB chips */}
      {industry.guides.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="career-industry-kb-chips">
          {industry.guides.map((g) => <KBChip key={g.docId} guide={g} />)}
        </div>
      )}

      {/* Match track CTA */}
      <button
        type="button"
        ref={setMatchTrackRest}
        onClick={() => onPickTrack?.(industry.matchTrackId, "leveling-up")}
        data-testid="career-industry-match-track-button"
        className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-md"
        style={{ fontWeight: 500 }}
      >
        See the matching track <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// -------- Recently went live (left feed) ------------------------------------
function RecentGolivesCard() {
  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-industry-golives"
    >
      <div className="flex items-center gap-2 mb-3">
        <Rocket className="w-4 h-4" style={{ color: "#1DB589" }} />
        <h3 className="text-[13px] font-semibold" style={{ color: "#0d1b2a" }}>
          Recently went live
        </h3>
      </div>
      <ul className="space-y-3">
        {RECENT_GOLIVES.map((g, i) => (
          <li key={`${g.org}-${i}`} className="text-[12.5px]" data-testid={`career-industry-golive-${i}`}>
            <div className="font-medium" style={{ color: "#0d1b2a" }}>
              {g.org} · <span style={{ color: "#666", fontWeight: 400 }}>{g.region}</span>
            </div>
            <div style={{ color: "#666" }}>
              {g.modules} · {g.when}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------- Heating up this quarter (right feed) ------------------------------
function HeatingUpCard() {
  return (
    <div
      className="rounded-xl bg-white p-5"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-industry-heating-up"
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4" style={{ color: "#F5B731" }} />
        <h3 className="text-[13px] font-semibold" style={{ color: "#0d1b2a" }}>
          Heating up this quarter
        </h3>
      </div>
      <ul className="space-y-2">
        {HEATING_UP.map((h, i) => (
          <li
            key={h.label}
            className="flex items-center gap-2 text-[12.5px]"
            data-testid={`career-industry-heating-${i}`}
            style={{ color: "#0d1b2a" }}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: "#F5B731" }} />
            <span>{h.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------- Main tab -----------------------------------------------------------
function IndustryTab({ onPickTrack }) {
  const [activeId, setActiveId] = useState("healthcare");
  const industry = INDUSTRIES.find((i) => i.id === activeId) || INDUSTRIES[0];

  return (
    <div className="mt-6 space-y-6" data-testid="career-industry-tab">
      <div
        className="rounded-xl bg-white p-6"
        style={{ border: "1px solid #eaeaea" }}
        data-testid="career-industry-card"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: "#0d1b2a" }}>
              Workday by industry
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#888" }}>
              <Briefcase className="w-3 h-3" />
              illustrative — community signal, not official data
            </span>
          </div>
        </div>

        <IndustryPills value={activeId} onChange={setActiveId} />

        <SnapshotPanel industry={industry} onPickTrack={onPickTrack} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <RecentGolivesCard />
        <HeatingUpCard />
      </div>
    </div>
  );
}

IndustryTab.heroProps = {
  eyebrow: "Industry pulse",
  title: "Where Workday is moving",
  subtitle: "Demand signals, hot modules, and recent go-lives — read the industry before you pick your next move.",
  rightPill: (
    <span
      className="inline-flex items-center text-[11px] font-semibold"
      style={{
        background: "rgba(29,181,137,0.18)",
        color: "#1DB589",
        border: "1px solid rgba(29,181,137,0.35)",
        borderRadius: 9999,
        padding: "6px 12px",
      }}
      data-testid="career-industry-hero-pill"
    >
      Community signals
    </span>
  ),
};

export default IndustryTab;

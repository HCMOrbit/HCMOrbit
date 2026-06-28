import React, { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import HeroMast from "./components/HeroMast";
import StageSegmented from "./components/StageSegmented";
import PhaseSpine from "./components/PhaseSpine";
import { TRACKS } from "./data";

// Resting-style helpers (setProperty + important beats the global button theme)
const setBackRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "transparent", "important");
  el.style.setProperty("color", "#1DB589", "important");
  el.style.setProperty("border", "none", "important");
};
const setArchitectRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#0a1628", "important");
  el.style.setProperty("color", "#ffffff", "important");
  el.style.setProperty("border", "none", "important");
};

function HeroPill({ children, testId }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("background", "rgba(29,181,137,0.18)", "important");
    el.style.setProperty("color", "#1DB589", "important");
    el.style.setProperty("border", "1px solid rgba(29,181,137,0.35)", "important");
  }, []);
  return (
    <span
      ref={ref}
      data-testid={testId}
      className="inline-flex items-center text-[11px] font-semibold"
      style={{ borderRadius: 9999, padding: "6px 12px" }}
    >
      {children}
    </span>
  );
}

function LeadsToCard({ leadsTo = [], canShowArchitect, onGoArchitect }) {
  return (
    <div
      className="mt-6 rounded-xl bg-white p-5"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-leads-to-card"
    >
      <div
        className="text-[10px] font-semibold mb-2"
        style={{ color: "#1DB589", letterSpacing: "1.2px", textTransform: "uppercase" }}
      >
        Where this leads
      </div>
      {leadsTo.length > 0 ? (
        <ul className="flex flex-wrap gap-2 mb-3">
          {leadsTo.map((role) => (
            <li
              key={role}
              data-testid={`career-leads-to-${role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className="inline-flex items-center text-[12.5px] font-medium"
              style={{
                background: "#f4f4f4",
                color: "#0d1b2a",
                borderRadius: 9999,
                padding: "5px 12px",
              }}
            >
              {role}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] mb-3" style={{ color: "#666" }}>
          Roles for this stage will appear as the roadmap data fills out.
        </p>
      )}
      {canShowArchitect && (
        <button
          type="button"
          ref={setArchitectRest}
          onClick={onGoArchitect}
          data-testid="career-go-architect-button"
          className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-md"
          style={{ fontWeight: 500 }}
        >
          Going architect <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ stageLabel, trackName }) {
  return (
    <div
      className="mt-6 rounded-xl bg-white p-8 text-center"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-roadmap-empty"
    >
      <div
        className="inline-flex items-center justify-center mb-3"
        style={{
          width: 44,
          height: 44,
          borderRadius: 9999,
          background: "rgba(29,181,137,0.12)",
          color: "#1DB589",
        }}
      >
        <Sparkles className="w-5 h-5" />
      </div>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#0d1b2a" }}>
        Roadmap coming soon
      </h3>
      <p className="text-[13px]" style={{ color: "#666" }}>
        We&apos;re still curating the {stageLabel?.toLowerCase() || "this stage"} roadmap for{" "}
        <span style={{ color: "#0d1b2a", fontWeight: 600 }}>{trackName}</span>. Try a different stage or another track.
      </p>
    </div>
  );
}

/**
 * RoadmapView — per-track roadmap; replaces the tab UI when roadmap !== null.
 *
 * Props:
 *  - roadmap:  { trackId, stage }
 *  - onBack:   () => void  — sets parent roadmap=null (returns to Paths tab)
 *  - onStage:  (stageId) => void  — updates the parent roadmap.stage
 */
export default function RoadmapView({ roadmap, onBack, onStage }) {
  const track = TRACKS.find((t) => t.id === roadmap?.trackId);
  const stage = roadmap?.stage || "leveling-up";
  const stageBlock = track?.stages?.[stage];
  const phases = Array.isArray(stageBlock?.phases) ? stageBlock.phases : [];
  const leadsTo = Array.isArray(stageBlock?.leadsTo) ? stageBlock.leadsTo : [];

  // Safety: track gone missing.
  if (!track) {
    return (
      <div className="mt-6" data-testid="career-roadmap-missing">
        <button
          type="button"
          ref={setBackRest}
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[12.5px] font-semibold mb-4"
          data-testid="career-roadmap-back"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Career paths
        </button>
        <div
          className="rounded-xl bg-white p-6 text-center text-[13px]"
          style={{ border: "1px solid #eaeaea", color: "#666" }}
        >
          We couldn&apos;t find that track. Head back and pick another.
        </div>
      </div>
    );
  }

  const completed = 0; // future: pull from user progress
  const phaseCount = phases.length;

  return (
    <div data-testid="career-roadmap-view">
      {/* Breadcrumb */}
      <button
        type="button"
        ref={setBackRest}
        onClick={onBack}
        data-testid="career-roadmap-back"
        className="inline-flex items-center gap-2 text-[12.5px] font-semibold mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span style={{ color: "#1DB589" }}>Career paths</span>
        <span style={{ color: "rgba(255,255,255,0)" }} aria-hidden="true">.</span>
        <span style={{ color: "#666", fontWeight: 500 }}>/ {track.name}</span>
      </button>

      <HeroMast
        eyebrow={`${track.name.toUpperCase()} TRACK`}
        title={`Build your ${track.name} career`}
        subtitle={track.blurb}
        rightPill={
          <HeroPill testId="career-roadmap-phase-pill">
            {completed} of {phaseCount} phases
          </HeroPill>
        }
      >
        <div className="mt-1">
          <StageSegmented
            value={stage}
            onChange={onStage}
            testId="career-roadmap-stage-segmented"
          />
        </div>
      </HeroMast>

      <div className="mt-6">
        {phaseCount === 0 ? (
          <EmptyState
            stageLabel={stage.replace(/-/g, " ")}
            trackName={track.name}
          />
        ) : (
          <PhaseSpine phases={phases} />
        )}
      </div>

      <LeadsToCard
        leadsTo={leadsTo}
        canShowArchitect={stage !== "going-architect"}
        onGoArchitect={() => onStage?.("going-architect")}
      />
    </div>
  );
}

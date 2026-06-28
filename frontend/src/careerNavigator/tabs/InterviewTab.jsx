import React, { useEffect, useRef, useState } from "react";
import {
  Banknote, Building2, Plug, Lock, BarChart3, UserPlus, Heart, CalendarDays,
  Brain, Workflow, RefreshCcw, ArrowRight, Sparkles,
} from "lucide-react";
import { TRACKS, INTERVIEW_SETS } from "../data";
import StatRow from "../components/StatRow";

const ICONS = {
  cash: Banknote,
  building: Building2,
  plug: Plug,
  lock: Lock,
  chart: BarChart3,
  userplus: UserPlus,
  heart: Heart,
  calendar: CalendarDays,
};

// -------- Resting-style helpers (setProperty + important beats global theme)
const setMisLoopRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#ffffff", "important");
  el.style.setProperty("color", "#0d1b2a", "important");
  el.style.setProperty("border", "1px solid #eaeaea", "important");
};
const setStartCoreRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#0a1628", "important");
  el.style.setProperty("color", "#ffffff", "important");
  el.style.setProperty("border", "none", "important");
};
const setStartScenarioRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#1DB589", "important");
  el.style.setProperty("color", "#ffffff", "important");
  el.style.setProperty("border", "none", "important");
};

// -------- View segmented (By module / By role) ------------------------------
function ViewSegmented({ value, onChange }) {
  const items = [
    { id: "module", label: "By module" },
    { id: "role",   label: "By role" },
  ];
  const refs = useRef({});
  useEffect(() => {
    items.forEach((it) => {
      const el = refs.current[it.id];
      if (!el) return;
      if (it.id === value) {
        el.style.setProperty("background", "#0a1628", "important");
        el.style.setProperty("color", "#ffffff", "important");
        el.style.setProperty("border", "1px solid #0a1628", "important");
      } else {
        el.style.setProperty("background", "#ffffff", "important");
        el.style.setProperty("color", "#0a1628", "important");
        el.style.setProperty("border", "1px solid #eaeaea", "important");
      }
    });
  }, [value]);
  return (
    <div role="tablist" aria-label="Group questions by" style={{ display: "inline-flex", gap: 6 }} data-testid="career-interview-view-segmented">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          ref={(el) => { refs.current[it.id] = el; }}
          onClick={() => onChange(it.id)}
          data-testid={`career-interview-view-${it.id}`}
          className="text-[12px] font-semibold"
          style={{ padding: "6px 12px", borderRadius: 9999, cursor: "pointer" }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// -------- Module pills row ---------------------------------------------------
function ModulePills({ value, onChange }) {
  const refs = useRef({});
  useEffect(() => {
    TRACKS.forEach((t) => {
      const el = refs.current[t.id];
      if (!el) return;
      if (t.id === value) {
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
    <div className="flex flex-wrap gap-2 mt-4" data-testid="career-interview-module-pills">
      {TRACKS.map((t) => {
        const Icon = ICONS[t.icon] || Banknote;
        return (
          <button
            key={t.id}
            type="button"
            ref={(el) => { refs.current[t.id] = el; }}
            onClick={() => onChange(t.id)}
            data-testid={`career-interview-module-${t.id}`}
            className="inline-flex items-center gap-2 text-[12.5px] font-medium"
            style={{ padding: "6px 12px", borderRadius: 9999, cursor: "pointer" }}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// -------- Single Question-Set card -------------------------------------------
function SetCard({ topBarColor, icon: Icon, eyebrow, count, reviewLabel, buttonLabel, buttonRefFn, testId }) {
  return (
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: "1px solid #eaeaea" }}
      data-testid={testId}
    >
      <div style={{ height: 4, background: topBarColor }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4" style={{ color: topBarColor }} />
          <div
            className="text-[10px] font-semibold"
            style={{ color: topBarColor, letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            {eyebrow}
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold" style={{ color: "#0d1b2a" }}>{count}</span>
          <span className="text-[13px]" style={{ color: "#666" }}>questions</span>
        </div>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); }}
          className="text-[12.5px] font-medium hover:underline"
          style={{ color: "#1DB589" }}
          data-testid={`${testId}-review-link`}
        >
          {reviewLabel} →
        </a>
        <div className="mt-4">
          <button
            type="button"
            ref={buttonRefFn}
            data-testid={`${testId}-button`}
            className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-md"
            style={{ fontWeight: 500 }}
          >
            {buttonLabel} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------- "Coming soon" guard ------------------------------------------------
function ComingSoonCard({ moduleName }) {
  return (
    <div
      className="rounded-xl bg-white p-8 text-center"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-interview-coming-soon"
    >
      <div
        className="inline-flex items-center justify-center mb-3"
        style={{ width: 44, height: 44, borderRadius: 9999, background: "rgba(29,181,137,0.12)", color: "#1DB589" }}
      >
        <Sparkles className="w-5 h-5" />
      </div>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#0d1b2a" }}>
        Question set coming soon
      </h3>
      <p className="text-[13px]" style={{ color: "#666" }}>
        We&apos;re still curating the question bank for{" "}
        <span style={{ color: "#0d1b2a", fontWeight: 600 }}>{moduleName}</span>. Try Payroll while we finish writing the rest.
      </p>
    </div>
  );
}

// -------- Miss-loop strip ----------------------------------------------------
function MissLoopStrip({ missedCount = 0 }) {
  return (
    <div
      className="rounded-xl bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      style={{ border: "1px solid #eaeaea" }}
      data-testid="career-interview-miss-loop"
    >
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 inline-flex items-center justify-center"
          style={{ width: 32, height: 32, borderRadius: 9999, background: "rgba(245,183,49,0.14)", color: "#8a5a00" }}
        >
          <RefreshCcw className="w-4 h-4" />
        </div>
        <p className="text-[13px]" style={{ color: "#0d1b2a" }}>
          Questions you miss resurface until you nail them.
        </p>
      </div>
      <button
        type="button"
        ref={setMisLoopRest}
        data-testid="career-interview-retake-missed"
        className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-md"
        style={{ fontWeight: 500 }}
      >
        Retake missed ({missedCount})
      </button>
    </div>
  );
}

// -------- Main tab -----------------------------------------------------------
function InterviewTab() {
  const [view, setView] = useState("module");
  const [activeModule, setActiveModule] = useState("payroll");

  const sets = INTERVIEW_SETS[activeModule];
  const activeTrack = TRACKS.find((t) => t.id === activeModule);

  return (
    <div className="mt-6 space-y-6" data-testid="career-interview-tab">
      <div
        className="rounded-xl bg-white p-6"
        style={{ border: "1px solid #eaeaea" }}
        data-testid="career-interview-prep-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-semibold" style={{ color: "#0d1b2a" }}>
            Prep by module or role
          </h2>
          <ViewSegmented value={view} onChange={setView} />
        </div>

        <ModulePills value={activeModule} onChange={setActiveModule} />

        <div className="mt-5">
          {sets ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <SetCard
                testId="career-interview-core-set"
                topBarColor="#1DB589"
                icon={Brain}
                eyebrow="Core questions"
                count={sets.core.count}
                reviewLabel={sets.core.reviewLabel}
                buttonLabel="Start core set"
                buttonRefFn={setStartCoreRest}
              />
              <SetCard
                testId="career-interview-scenario-set"
                topBarColor="#F5B731"
                icon={Workflow}
                eyebrow="Scenario practice"
                count={sets.scenario.count}
                reviewLabel={sets.scenario.reviewLabel}
                buttonLabel="Start scenarios"
                buttonRefFn={setStartScenarioRest}
              />
            </div>
          ) : (
            <ComingSoonCard moduleName={activeTrack?.name || activeModule} />
          )}
        </div>
      </div>

      <StatRow
        items={[
          { label: "Best core",      value: "—" },
          { label: "Best scenario",  value: "—" },
          { label: "Last attempt",   value: "—" },
          { label: "Bookmarked",     value: "0" },
        ]}
      />

      <MissLoopStrip missedCount={0} />
    </div>
  );
}

InterviewTab.heroProps = {
  eyebrow: "Interview prep",
  title: "Walk in ready",
  subtitle: "Core questions for the modules you'll be tested on, plus scenario drills that mirror how clients actually grill consultants.",
  rightPill: null,
};

export default InterviewTab;

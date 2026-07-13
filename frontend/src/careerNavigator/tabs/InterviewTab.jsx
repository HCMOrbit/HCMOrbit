import React, { useEffect, useRef, useState } from "react";
import {
  Banknote, Building2, Plug, Lock, BarChart3, UserPlus, Heart, CalendarDays,
  Brain, Workflow, RefreshCcw, ArrowRight, Sparkles,
} from "lucide-react";
import { TRACKS, INTERVIEW_SETS } from "../data";
import getStudyPlan, { ROLES } from "../../services/studyPlan";
import {
  T as SP_T,
  Stage,
  ContentTile,
  Chip,
  cardStyle,
} from "../studyPlanShared";

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
  const [role, setRole] = useState(ROLES[0]);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (view !== "role") return;
    let cancelled = false;
    setPlan(null);
    getStudyPlan(role).then((p) => { if (!cancelled) setPlan(p); });
    return () => { cancelled = true; };
  }, [view, role]);

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

        {view === "module" ? (
          <>
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
          </>
        ) : (
          <RoleStudyPanel role={role} onRoleChange={setRole} plan={plan} />
        )}
      </div>

      {/* Progress stats row (Best core / Best scenario / Last attempt /
          Bookmarked) hidden until per-user progress tracking is wired. */}

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

// -------- Role mode: study plan panel ----------------------------------------
// Local palette/components kept intentionally alongside the shared ones from
// studyPlanShared.jsx so the surface stays visually stable.
const RT = {
  brand: "#1B3A6B",
  accent: "#2E75B6",
  ink: "#1A1A1A",
  sub: "#5F6B7A",
  muted: "#9AA4B0",
  line: "#E4E8EE",
  page: "#F6F8FB",
  card: "#FFFFFF",
  tintGreen: "#E8F5E9",
  greenText: "#1E7A3E",
  tintAmber: "#FFF3CD",
  amberText: "#8A6100",
  tintBlue: "#EBF3FB",
};

function RolePanelSkeleton() {
  return (
    <div style={{ marginTop: 18 }} data-testid="career-interview-role-loading">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            height: 44, borderRadius: 8, background: "linear-gradient(90deg, #F1F4F9 0%, #E9EEF5 50%, #F1F4F9 100%)",
            backgroundSize: "200% 100%", animation: "cnRoleShimmer 1.2s linear infinite",
          }} />
        ))}
      </div>
      <style>{`@keyframes cnRoleShimmer { 0% { background-position: 0% 0%; } 100% { background-position: -200% 0%; } }`}</style>
    </div>
  );
}

function RoleStudyPanel({ role, onRoleChange, plan }) {
  const [openStage, setOpenStage] = useState(0);

  return (
    <div style={{ marginTop: 18, fontFamily: "Arial, sans-serif" }} data-testid="career-interview-role-panel">
      {/* Role selector row */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        border: `0.5px solid ${RT.line}`, borderRadius: 12, padding: "12px 14px", background: RT.card,
      }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 8,
          border: "0.5px solid #CDD5E0", borderRadius: 8, padding: "9px 12px",
          background: "#fff", flex: 1, minWidth: 220,
        }}>
          <span style={{ color: RT.sub, fontSize: 13 }}>Role</span>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            data-testid="career-interview-role-select"
            style={{
              border: "none", background: "transparent", fontSize: 13, fontWeight: 600,
              color: RT.ink, marginLeft: "auto", outline: "none", cursor: "pointer",
            }}
          >
            {ROLES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <div style={{ fontSize: 12, color: RT.sub }} data-testid="career-interview-role-counts">
          {plan ? `${plan.totalKbs} KBs · ${plan.publishedKbs} published` : "Loading plan…"}
        </div>
      </div>

      {!plan ? (
        <RolePanelSkeleton />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start", marginTop: 14 }}>
          {/* LEFT — roadmap spine */}
          <section style={cardStyleRT()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Study plan overview</span>
              <span style={{ fontSize: 12, color: RT.sub }}>
                {plan.totalKbs} KBs · {plan.publishedKbs} published
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: RT.sub, margin: "2px 0 10px" }}>
              Stages built by grouping KBs on <code>technical_focus</code>. Counts are live.
            </p>

            {plan.stages.map((s, i) => (
              <StageRow
                key={s.name}
                s={s}
                open={openStage === i}
                onToggle={() => setOpenStage(openStage === i ? -1 : i)}
              />
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <MetricTile label="Estimated time" value={plan.estimatedHours} />
              <MetricTile label="Difficulty" value={plan.difficultyRange} />
            </div>
          </section>

          {/* RIGHT — what's included + recommended guides */}
          <section>
            <div style={{ ...cardStyleRT(), marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>What&apos;s included</span>
              <div style={{ marginTop: 8 }}>
                {plan.contentTiles.map((t) => <ContentTileRT key={t.key} t={t} />)}
              </div>
            </div>

            <div style={cardStyleRT()}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Recommended KB guides</span>
              <p style={{ fontSize: 12.5, color: RT.sub, margin: "2px 0 6px" }}>
                Top of the result set by interview weight
              </p>
              {plan.guides.length === 0 ? (
                <p style={{ fontSize: 12.5, color: RT.muted, padding: "8px 0", margin: 0 }}>
                  No published guides for this role yet.
                </p>
              ) : (
                plan.guides.map((g) => {
                  const pub = g.status === "Published";
                  return pub ? (
                    <a
                      key={g.kb_id}
                      href={g.source_url}
                      style={{
                        display: "flex", gap: 8, alignItems: "center",
                        padding: "7px 0", borderTop: `0.5px solid ${RT.line}`,
                        fontSize: 13, color: RT.accent, textDecoration: "none",
                      }}
                      data-testid={`career-interview-role-guide-${g.kb_id}`}
                    >
                      <span style={{ color: RT.accent }}>→</span>
                      <span style={{ flex: 1 }}>{g.title}</span>
                    </a>
                  ) : (
                    <div
                      key={g.kb_id}
                      style={{
                        display: "flex", gap: 8, alignItems: "center",
                        padding: "7px 0", borderTop: `0.5px solid ${RT.line}`,
                        fontSize: 13, color: RT.muted,
                      }}
                    >
                      <span>→</span>
                      <span style={{ flex: 1 }}>{g.title}</span>
                      <ChipRT bg="#fff" fg={RT.muted} border>KB in production</ChipRT>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StageRow({ s, open, onToggle }) {
  const isEmpty = s.total === 0;
  return (
    <div style={{ borderBottom: `0.5px solid ${RT.line}` }} data-testid={`career-interview-role-stage-${s.order}`}>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer", opacity: isEmpty ? 0.68 : 1 }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: "50%",
          background: RT.tintBlue, color: RT.accent,
          fontSize: 12, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{s.order}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: RT.sub }}>
            {isEmpty ? "No topics yet" : (s.foci.join(", ") || "No topics yet")}
          </div>
        </div>
        {isEmpty
          ? <span style={{ fontSize: 11.5, color: RT.muted }}>no topics yet</span>
          : <span style={{ fontSize: 13, fontWeight: 700 }}>{s.total}</span>}
        <span style={{ color: RT.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 12 }}>▾</span>
      </div>
      {open && !isEmpty && (
        <div style={{ background: RT.page, borderRadius: 8, padding: "4px 10px", marginBottom: 8 }}>
          {s.items.slice(0, 6).map((r) => <KbRowRT key={r.kb_id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function KbRowRT({ r }) {
  const pub = r.status === "Published";
  const common = { display: "flex", alignItems: "center", gap: 9, padding: "7px 0", fontSize: 13, borderTop: `0.5px solid ${RT.line}` };
  return pub ? (
    <a
      href={r.source_url}
      style={{ ...common, color: RT.ink, textDecoration: "none" }}
      data-testid={`career-interview-role-kb-${r.kb_id}`}
    >
      <span style={{ color: RT.accent }}>↗</span>
      <span style={{ flex: 1 }}>{r.title}</span>
      <ChipRT bg={RT.tintGreen} fg={RT.greenText}>Published</ChipRT>
    </a>
  ) : (
    <div
      style={{ ...common, color: RT.muted }}
      data-testid={`career-interview-role-kb-${r.kb_id}`}
    >
      <span>🔒</span>
      <span style={{ flex: 1 }}>{r.title}</span>
      <ChipRT bg="#fff" fg={RT.muted} border>KB in production</ChipRT>
    </div>
  );
}

function ContentTileRT({ t }) {
  const live = t.count > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 11px", border: `0.5px solid ${RT.line}`, borderRadius: 8,
      marginBottom: 7, opacity: live ? 1 : 0.72,
    }}>
      <span style={{ fontSize: 13 }}>{t.label}</span>
      {live
        ? <span style={{ fontSize: 15, fontWeight: 700 }}>{t.count}</span>
        : <ChipRT bg={RT.tintAmber} fg={RT.amberText}>Coming soon</ChipRT>}
    </div>
  );
}

function MetricTile({ label, value }) {
  return (
    <div style={{ flex: 1, background: RT.page, borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontSize: 12, color: RT.sub }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const ChipRT = ({ children, bg, fg, border }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
    background: bg, color: fg,
    border: border ? `0.5px solid ${RT.line}` : "none",
    whiteSpace: "nowrap",
  }}>{children}</span>
);

function cardStyleRT() {
  return { background: RT.card, border: `0.5px solid ${RT.line}`, borderRadius: 12, padding: "16px 18px" };
}

export default InterviewTab;

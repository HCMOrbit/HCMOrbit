/**
 * StudyPlan.jsx — Career Hub "Build your interview study plan" page.
 *
 * Frontend-first build. The whole page is derived from a single getStudyPlan(role)
 * call. No panel hard-codes article lists or numbers. When the backend lands, only
 * services/studyPlan.js changes — this component does not.
 *
 * Brand: #1B3A6B (brand blue) / #2E75B6 (accent). Arial. No external UI library.
 */

import React, { useMemo, useState } from "react";
import getStudyPlan, { ROLES } from "../services/studyPlan";

const T = {
  brand: "#1B3A6B",
  accent: "#2E75B6",
  ink: "#1A1A1A",
  sub: "#5F6B7A",
  muted: "#9AA4B0",
  line: "#E4E8EE",
  page: "#F6F8FB",
  card: "#FFFFFF",
  tintBlue: "#EBF3FB",
  tintGreen: "#E8F5E9",
  greenText: "#1E7A3E",
  tintAmber: "#FFF3CD",
  amberText: "#8A6100",
};

// --- minimal inline icons (no dependency) ---
const I = {
  chevron: "M6 9l6 6 6-6",
  external: "M14 4h6v6 M20 4l-9 9 M19 13v6a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h6",
  lock: "M6 11h12v9H6z M9 11V7a3 3 0 016 0v4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  clock: "M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z",
  wand: "M5 19l9-9 M14 6l4 4 M16 4l1 1 M20 8l1 1",
};
function Icon({ d, size = 16, color = "currentColor", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      {d.split(" M").map((seg, i) => (
        <path key={i} d={(i ? "M" : "") + seg} />
      ))}
    </svg>
  );
}

export default function StudyPlan() {
  const [role, setRole] = useState("Payroll Consultant");
  const [openStage, setOpenStage] = useState(0);
  const plan = useMemo(() => getStudyPlan(role), [role]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: T.ink, background: T.page, minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* breadcrumb + title */}
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 6 }}>
          Home &nbsp;›&nbsp; Interview prep &nbsp;›&nbsp; <span style={{ color: T.ink }}>Study plan</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", color: T.brand }}>
          Build your interview study plan
        </h1>
        <p style={{ color: T.sub, fontSize: 14, margin: "0 0 18px" }}>
          Choose a role to get a study plan assembled from the HCMOrbit KB registry.
        </p>

        {/* selector bar */}
        <div style={{ ...cardStyle(), display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <Selector label="Role" value={role} options={ROLES} onChange={setRole} />
          <Field label="Module" value={plan.module === "*" ? "All modules" : plan.module} readOnly />
          <button style={genBtn()}>
            <Icon d={I.wand} size={15} color="#fff" /> &nbsp;Generate study plan
          </button>
        </div>

        {/* three columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 0.9fr", gap: 16, alignItems: "start" }}>
          {/* LEFT — roadmap spine */}
          <section style={cardStyle()}>
            <Row between>
              <H>Study plan overview</H>
              <span style={{ fontSize: 12, color: T.sub }}>
                {plan.totalKbs} KBs · {plan.publishedKbs} published
              </span>
            </Row>
            <p style={{ fontSize: 12.5, color: T.sub, margin: "2px 0 10px" }}>
              Stages built by grouping KBs on <code>technical_focus</code>. Counts are live.
            </p>

            {plan.stages.map((s, i) => (
              <Stage key={s.name} s={s} open={openStage === i} onToggle={() => setOpenStage(openStage === i ? -1 : i)} />
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <Metric icon={I.clock} label="Estimated time" value={plan.estimatedHours} />
              <Metric label="Difficulty" value={plan.difficultyRange} />
            </div>
          </section>

          {/* CENTER — what's included */}
          <section>
            <div style={{ ...cardStyle(), marginBottom: 14 }}>
              <H>What&apos;s included</H>
              <div style={{ marginTop: 8 }}>
                {plan.contentTiles.map((t) => <ContentTile key={t.key} t={t} />)}
              </div>
            </div>

            <div style={cardStyle()}>
              <H>Recommended KB guides</H>
              <p style={{ fontSize: 12.5, color: T.sub, margin: "2px 0 6px" }}>
                Top of the result set by interview weight
              </p>
              {plan.guides.length === 0 ? (
                <Empty>No published guides for this role yet.</Empty>
              ) : (
                plan.guides.map((g) => (
                  <div key={g.kb_id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: `0.5px solid ${T.line}`, fontSize: 13 }}>
                    <Icon d={I.arrow} size={14} color={T.accent} />
                    <span style={{ color: T.accent, flex: 1 }}>{g.title}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* RIGHT — tools + progress */}
          <section>
            <div style={{ ...cardStyle(), marginBottom: 14 }}>
              <H>Recommended tools</H>
              {[
                ["Flashcards", "Reinforce key terms and definitions"],
                ["Quick revise", "One-pagers for last-minute prep"],
                ["Mock interview", "Practice with an AI interviewer"],
                ["Progress tracker", "Track your preparation progress"],
              ].map(([t, d]) => (
                <div key={t} style={{ padding: "9px 0", borderTop: `0.5px solid ${T.line}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12, color: T.sub }}>{d}</div>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle(), background: T.page }}>
              <Row><Icon d={I.lock} size={15} color={T.sub} /> &nbsp;<span style={{ fontSize: 13.5, fontWeight: 600 }}>Your progress</span></Row>
              <p style={{ fontSize: 12.5, color: T.sub, margin: "6px 0 0" }}>
                Available after sign-in — no live tracker until <code>user_progress</code> exists.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function Stage({ s, open, onToggle }) {
  return (
    <div style={{ borderBottom: `0.5px solid ${T.line}` }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer" }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.tintBlue, color: T.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {s.order}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: T.sub }}>{s.foci.join(", ") || "No topics yet"}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.total}</span>
        <Icon d={I.chevron} size={14} color={T.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </div>
      {open && (
        <div style={{ background: T.page, borderRadius: 8, padding: "4px 10px", marginBottom: 8 }}>
          {s.items.length === 0 ? (
            <Empty>No KBs mapped to this stage yet.</Empty>
          ) : (
            s.items.slice(0, 6).map((r) => <KbRow key={r.kb_id} r={r} />)
          )}
        </div>
      )}
    </div>
  );
}

function KbRow({ r }) {
  const pub = r.status === "Published";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", fontSize: 13, borderTop: `0.5px solid ${T.line}` }}>
      <Icon d={pub ? I.external : I.lock} size={14} color={pub ? T.accent : T.muted} />
      <a href={pub ? r.source_url : undefined}
        style={{ flex: 1, color: pub ? T.ink : T.muted, textDecoration: "none", cursor: pub ? "pointer" : "default" }}>
        {r.title}
      </a>
      {pub
        ? <Chip bg={T.tintGreen} fg={T.greenText}>Published</Chip>
        : <Chip bg="#fff" fg={T.muted} border>KB in production</Chip>}
    </div>
  );
}

function ContentTile({ t }) {
  const live = t.count > 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", border: `0.5px solid ${T.line}`, borderRadius: 8, marginBottom: 7, opacity: live ? 1 : 0.72 }}>
      <span style={{ fontSize: 13 }}>{t.label}</span>
      {live
        ? <span style={{ fontSize: 15, fontWeight: 700 }}>{t.count}</span>
        : <Chip bg={T.tintAmber} fg={T.amberText}>Coming soon</Chip>}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div style={{ flex: 1, background: T.page, borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontSize: 12, color: T.sub, display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <Icon d={icon} size={13} color={T.sub} />}{label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Selector({ label, value, options, onChange }) {
  return (
    <label style={fieldShell()}>
      <span style={{ color: T.sub, fontSize: 13 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: T.ink, marginLeft: "auto", outline: "none", cursor: "pointer" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Field({ label, value }) {
  return (
    <div style={fieldShell()}>
      <span style={{ color: T.sub, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: "auto" }}>{value}</span>
    </div>
  );
}

const Chip = ({ children, bg, fg, border }) => (
  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: bg, color: fg, border: border ? `0.5px solid ${T.line}` : "none", whiteSpace: "nowrap" }}>
    {children}
  </span>
);
const H = ({ children }) => <span style={{ fontSize: 15, fontWeight: 700 }}>{children}</span>;
const Empty = ({ children }) => <p style={{ fontSize: 12.5, color: T.muted, padding: "8px 0", margin: 0 }}>{children}</p>;
const Row = ({ children, between }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: between ? "space-between" : "flex-start" }}>{children}</div>
);

/* ---------- style helpers ---------- */
function cardStyle() {
  return { background: T.card, border: `0.5px solid ${T.line}`, borderRadius: 12, padding: "16px 18px" };
}
function fieldShell() {
  return { display: "flex", alignItems: "center", gap: 8, border: `0.5px solid #CDD5E0`, borderRadius: 8, padding: "9px 12px", background: "#fff", flex: 1, minWidth: 200 };
}
function genBtn() {
  return { background: T.brand, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" };
}

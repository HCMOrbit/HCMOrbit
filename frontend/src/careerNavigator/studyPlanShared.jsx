/**
 * Shared Study-Plan rendering primitives, extracted verbatim from the retired
 * standalone /study-plan page. Consumed by
 *   src/careerNavigator/tabs/InterviewTab.jsx (RoleStudyPanel)
 * and available for any future surface that wants to render the same
 * roadmap/stage/tile/guide styling without duplicating markup.
 *
 * Behaviour and styles are unchanged from the original StudyPlan.jsx locals —
 * this is a mechanical extraction, not a redesign.
 */
import React from "react";

// ---- palette --------------------------------------------------------------
export const T = {
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

// ---- inline icons (no lucide dependency) ----------------------------------
export const I = {
  chevron: "M6 9l6 6 6-6",
  external: "M14 4h6v6 M20 4l-9 9 M19 13v6a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h6",
  lock: "M6 11h12v9H6z M9 11V7a3 3 0 016 0v4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  clock: "M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z",
  wand: "M5 19l9-9 M14 6l4 4 M16 4l1 1 M20 8l1 1",
};

export function Icon({ d, size = 16, color = "currentColor", style }) {
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

// ---- style helpers --------------------------------------------------------
export function cardStyle() {
  return { background: T.card, border: `0.5px solid ${T.line}`, borderRadius: 12, padding: "16px 18px" };
}
export function fieldShell() {
  return { display: "flex", alignItems: "center", gap: 8, border: `0.5px solid #CDD5E0`, borderRadius: 8, padding: "9px 12px", background: "#fff", flex: 1, minWidth: 200 };
}
export function genBtn() {
  return { background: T.brand, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" };
}

// ---- primitives -----------------------------------------------------------
export const Chip = ({ children, bg, fg, border }) => (
  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: bg, color: fg, border: border ? `0.5px solid ${T.line}` : "none", whiteSpace: "nowrap" }}>
    {children}
  </span>
);
export const H = ({ children }) => <span style={{ fontSize: 15, fontWeight: 700 }}>{children}</span>;
export const Empty = ({ children }) => <p style={{ fontSize: 12.5, color: T.muted, padding: "8px 0", margin: 0 }}>{children}</p>;
export const Row = ({ children, between }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: between ? "space-between" : "flex-start" }}>{children}</div>
);

// ---- subcomponents --------------------------------------------------------
export function Stage({ s, open, onToggle }) {
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

export function KbRow({ r }) {
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

export function ContentTile({ t }) {
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

export function Metric({ icon, label, value }) {
  return (
    <div style={{ flex: 1, background: T.page, borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontSize: 12, color: T.sub, display: "flex", alignItems: "center", gap: 5 }}>
        {icon && <Icon d={icon} size={13} color={T.sub} />}{label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export function Selector({ label, value, options, onChange }) {
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

export function Field({ label, value }) {
  return (
    <div style={fieldShell()}>
      <span style={{ color: T.sub, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: "auto" }}>{value}</span>
    </div>
  );
}

import React from "react";
import { Wrench, ListChecks, Zap, BookOpen, CheckSquare } from "lucide-react";

const TYPE_MAP = {
  fix_guide: { label: "Fix guide", bg: "#FCEBEB", text: "#791F1F", Icon: Wrench, border: "#E24B4A" },
  how_to: { label: "How-to", bg: "#E6F1FB", text: "#0C447C", Icon: ListChecks, border: "#1D6FE8" },
  learning_bite: { label: "Learning bite", bg: "#E1F5EE", text: "#085041", Icon: Zap, border: "#0D9373" },
  reference: { label: "Reference", bg: "#EEEDFE", text: "#3C3489", Icon: BookOpen, border: "#7F77DD" },
  checklist: { label: "Checklist", bg: "#FAEEDA", text: "#633806", Icon: CheckSquare, border: "#EF9F27" },
};

const DIFF_MAP = {
  beginner: { bg: "#EAF3DE", text: "#27500A" },
  intermediate: { bg: "#E6F1FB", text: "#0C447C" },
  advanced: { bg: "#FAEEDA", text: "#633806" },
};

const CAT_BG = {
  integrations: "#EFF6FF", reporting: "#EEEDFE", security: "#FEF2F2",
  "core-hcm": "#E1F5EE", payroll: "#FFFBEB", "career-dev": "#EAF3DE",
};

export function DocTypeBadge({ type }) {
  const v = TYPE_MAP[type];
  if (!v) return null;
  const { Icon } = v;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" style={{ background: v.bg, color: v.text }} data-testid={`doc-type-${type}`}>
      <Icon className="w-3 h-3" /> {v.label}
    </span>
  );
}

export function DifficultyBadge({ level }) {
  const v = DIFF_MAP[level];
  if (!v) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider capitalize" style={{ background: v.bg, color: v.text }}>
      {level}
    </span>
  );
}

export function VersionPill({ version }) {
  if (!version) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border" style={{ background: "#F1EFE8", color: "#5F5E5A", borderColor: "#D3D1C7" }}>
      {version}
    </span>
  );
}

export function CategoryIcon({ slug, icon, size = "md" }) {
  const sz = size === "lg" ? "w-12 h-12 text-2xl" : "w-9 h-9 text-base";
  return (
    <div className={`${sz} rounded-md flex items-center justify-center shrink-0`} style={{ background: CAT_BG[slug] || "#F1F5F9" }}>
      <span>{icon}</span>
    </div>
  );
}

export const TYPE_BORDER = (t) => TYPE_MAP[t]?.border || "#94A3B8";

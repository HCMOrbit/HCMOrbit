/**
 * STUDY PLAN SERVICE — the one function the whole page depends on.
 *
 * getStudyPlan(role, module) is the ONLY data call the UI makes. Every panel on
 * the page is a count or grouping over its result. No component hard-codes an
 * article list or a number.
 *
 * BACKEND SWAP: today this filters the mock KB_REGISTRY array. When the API is
 * ready, replace the body of fetchKbRows() with a single fetch — nothing else
 * (and no component) changes. See the TODO below.
 */

import KB_REGISTRY from "../data/kbRegistry";

/**
 * technical_focus -> study stage. Stored as data, not branching logic, so a new
 * module reuses it and you can tune mappings without touching components.
 * Mirror this as a `study_stage_map` table when the backend lands.
 */
export const STUDY_STAGE_MAP = {
  // Fundamentals
  Architecture: "Fundamentals",
  Design: "Fundamentals",
  "Data Model": "Fundamentals",
  Security: "Fundamentals",
  // Configuration
  Configuration: "Configuration",
  Compliance: "Configuration",
  Governance: "Configuration",
  Rules: "Configuration",
  // Processes
  Retro: "Processes",
  Reconciliation: "Processes",
  Close: "Processes",
  "Production Support": "Processes",
  Operations: "Processes",
  // Reporting
  Reporting: "Reporting",
  Analytics: "Reporting",
  Audit: "Reporting",
  // Integrations
  Integration: "Integrations",
  // Scenarios & troubleshooting
  Troubleshooting: "Scenarios & troubleshooting",
  Pitfalls: "Scenarios & troubleshooting",
  Scenario: "Scenarios & troubleshooting",
};

// Display order + icon hint for the roadmap spine. Keeps the 6-stage shape stable
// even when a module has zero KBs in a stage (the stage still renders, count 0).
export const STAGE_ORDER = [
  { name: "Fundamentals", icon: "book" },
  { name: "Configuration", icon: "settings" },
  { name: "Processes", icon: "flow" },
  { name: "Reporting", icon: "chart" },
  { name: "Integrations", icon: "plug" },
  { name: "Scenarios & troubleshooting", icon: "wrench" },
];

/**
 * role -> module filter. From Role_Auto_Map. The role selector drives which
 * module's KBs load. "*" means no module restriction (architect-style roles).
 */
export const ROLE_MODULE_MAP = {
  "Payroll Consultant": "Payroll",
  "Security Consultant": "Security & Compliance",
  "Reporting Analyst": "Analytics & Reporting",
  "Senior HRIS Analyst": "Core HCM",
};

export const ROLES = Object.keys(ROLE_MODULE_MAP);

// Content types surfaced in "What's included". Only KB exists in the registry
// today; the rest are future artifact types and will report a live count of 0
// until they are authored (the UI renders 0 as "Coming soon", never a dead "0").
const CONTENT_TYPES = [
  { key: "kb", label: "Related KB articles", icon: "book", artifact: "KB" },
  { key: "questions", label: "Core questions", icon: "help", artifact: "Question" },
  { key: "scenarios", label: "Scenario practice", icon: "puzzle", artifact: "Scenario" },
  { key: "concepts", label: "Key concepts", icon: "bulb", artifact: "Concept" },
  { key: "failures", label: "Failure patterns", icon: "alert", artifact: "Failure" },
  { key: "mock", label: "Mock interview", icon: "userCheck", artifact: "Mock" },
];

const DIFF_ORDER = ["Intermediate", "Advanced", "Expert"];

/**
 * The data seam. Swap this one function for an API call later.
 * TODO(backend): replace body with
 *   const res = await fetch(`/api/study-plan?role=${role}&module=${module}`);
 *   return res.json();  // already-filtered rows in the same shape
 */
function fetchKbRows({ module }) {
  return KB_REGISTRY.filter((r) =>
    module === "*" ? true : r.module === module
  );
}

export function getStudyPlan(role) {
  const module = ROLE_MODULE_MAP[role] || "*";
  const rows = fetchKbRows({ module });

  // ---- roadmap spine: group rows into the 6 fixed stages ----
  const stages = STAGE_ORDER.map((s, i) => {
    const items = rows.filter(
      (r) => STUDY_STAGE_MAP[r.technical_focus] === s.name
    );
    return {
      order: i + 1,
      name: s.name,
      icon: s.icon,
      foci: [...new Set(items.map((r) => r.technical_focus))],
      total: items.length,
      published: items.filter((r) => r.status === "Published").length,
      items: items.sort(
        (a, b) => weightRank(b) - weightRank(a) || a.kb_id.localeCompare(b.kb_id)
      ),
    };
  });

  // ---- "what's included" tiles: live count per content type ----
  const contentTiles = CONTENT_TYPES.map((c) => ({
    ...c,
    count:
      c.artifact === "KB"
        ? rows.length
        : rows.filter((r) => (r.artifact_type || "KB") === c.artifact).length,
  }));

  // ---- recommended guides: top of the result set by interview weight ----
  const guides = [...rows]
    .sort((a, b) => weightRank(b) - weightRank(a) || a.kb_id.localeCompare(b.kb_id))
    .slice(0, 4);

  return {
    role,
    module,
    totalKbs: rows.length,
    publishedKbs: rows.filter((r) => r.status === "Published").length,
    stages,
    contentTiles,
    guides,
    difficultyRange: difficultyRange(rows),
    estimatedHours: estimateHours(rows),
  };
}

function weightRank(r) {
  return r.interview_weight === "High" ? 2 : 1;
}

function difficultyRange(rows) {
  const present = DIFF_ORDER.filter((d) => rows.some((r) => r.difficulty === d));
  if (present.length === 0) return "—";
  if (present.length === 1) return present[0];
  return `${present[0]}–${present[present.length - 1]}`;
}

// Rough study-time estimate: ~0.2h per KB, banded. Replace with real per-module
// hours from the Learning Tracks workbook when that table is wired in.
function estimateHours(rows) {
  const lo = Math.max(4, Math.round(rows.length * 0.18));
  const hi = Math.round(rows.length * 0.24);
  return `${lo}–${hi} hrs`;
}

export default getStudyPlan;

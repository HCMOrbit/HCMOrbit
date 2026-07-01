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

import { api } from "../lib/api";

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
 * The data seam. Fetches live rows from the KB backend and maps them to the
 * exact shape kbRegistry.js returns, so getStudyPlan() needs zero changes.
 *
 * Endpoint: GET /api/kb/docs?include_drafts=true&limit=500
 *   - `include_drafts=true` is critical: Study Plan greys unpublished rows as
 *     "KB in production", so we need BOTH published and draft docs.
 *   - Draft rows come back with a lightweight projection (no body/summary),
 *     so this call is safe to make from the public Study Plan page.
 *
 * Field mapping (backend -> registry shape used by getStudyPlan):
 *   reference_id           -> kb_id, document_id (fallback to uuid `id`)
 *   title                  -> title
 *   category.name (looked  -> module        (matches ROLE_MODULE_MAP values)
 *     up from /kb/categories)
 *   sub_module             -> sub_module
 *   derived (tags/sub)     -> technical_focus (see deriveFocus)
 *   difficulty             -> difficulty
 *   is_featured            -> interview_weight ("High" if true, else "Medium")
 *   is_published           -> status ("Published" | "Planned")
 *   /knowledge-base/{slug} -> source_url
 *     /{id}
 */
async function fetchKbRows({ module }) {
  try {
    const [docsRes, catsRes] = await Promise.all([
      api.get("/kb/docs?include_drafts=true&limit=500"),
      api.get("/kb/categories"),
    ]);
    const nameBySlug = {};
    (catsRes.data || []).forEach((c) => { nameBySlug[c.slug] = c.name; });

    const focusKeys = Object.keys(STUDY_STAGE_MAP);
    const deriveFocus = (d) => {
      const tags = (d.tags || []).map((t) => String(t).toLowerCase());
      for (const k of focusKeys) if (tags.includes(k.toLowerCase())) return k;
      const sub = String(d.sub_module || "").toLowerCase();
      for (const k of focusKeys) if (sub.includes(k.toLowerCase())) return k;
      return "";
    };

    const rows = (docsRes.data?.docs || []).map((d) => {
      const moduleName = nameBySlug[d.category_slug] || d.category_slug || "";
      const slug = d.category_slug || "unknown";
      return {
        kb_id: d.reference_id || d.id,
        document_id: d.reference_id || d.id,
        title: d.title,
        module: moduleName,
        sub_module: d.sub_module || "",
        technical_focus: deriveFocus(d),
        difficulty: d.difficulty || "",
        interview_weight: d.is_featured ? "High" : "Medium",
        status: d.is_published ? "Published" : "Planned",
        source_url: `/knowledge-base/${slug}/${d.id}`,
        artifact_type: "KB",
      };
    });

    return module === "*" ? rows : rows.filter((r) => r.module === module);
  } catch (err) {
    console.error("[studyPlan] fetchKbRows failed:", err);
    return [];
  }
}

export async function getStudyPlan(role) {
  const module = ROLE_MODULE_MAP[role] || "*";
  const rows = await fetchKbRows({ module });

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

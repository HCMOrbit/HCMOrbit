/**
 * MOCK KB REGISTRY — temporary frontend data source.
 *
 * Every object here is shaped EXACTLY like one row of the real `kb_articles`
 * table (same field names as HCMOrbit_KB_Linking_Database_v1 -> 01_KB_Registry).
 * When the backend is ready, delete this file and have studyPlan.js call the API.
 * The UI never reads this file directly — it only ever calls getStudyPlan().
 *
 * Field contract (do not rename — these are the real registry columns):
 *   kb_id, document_id, title, module, sub_module, technical_focus,
 *   difficulty, target_roles, interview_weight, status, source_url
 *
 * status values: "Published" (live, linkable) | "Planned" (shown greyed, "in production")
 * interview_weight: "High" | "Medium"
 * difficulty: "Intermediate" | "Advanced" | "Expert"
 */

const URL = "https://www.hcmorbit.com/knowledge-base";

// Compact seed expanded into full rows below. Each entry:
// [submodule, technical_focus, difficulty, interview_weight, status, titleSuffix]
const PAYROLL_SEED = [
  ["Workday Payroll (US, UK, Canada, France)", "Architecture", "Advanced", "High", "Published", "designing a multi-country pay group model"],
  ["Workday Payroll (US, UK, Canada, France)", "Architecture", "Expert", "High", "Planned", "why one pay group per country is not always right"],
  ["Workday Payroll (US, UK, Canada, France)", "Security", "Advanced", "High", "Published", "payroll security domains and who can see pay results"],
  ["Workday Payroll (US, UK, Canada, France)", "Governance", "Advanced", "High", "Planned", "pay calc group change control"],
  ["Gross-to-Net Processing", "Architecture", "Expert", "High", "Published", "the gross-to-net object model end to end"],
  ["Gross-to-Net Processing", "Retro", "Expert", "High", "Planned", "retro pay calculation order and the audit trail it leaves"],
  ["Gross-to-Net Processing", "Retro", "Advanced", "High", "Planned", "what recalculates when you backdate a comp change"],
  ["Gross-to-Net Processing", "Troubleshooting", "Advanced", "High", "Planned", "why off-cycle runs silently double-post mid-period"],
  ["Gross-to-Net Processing", "Pitfalls", "Advanced", "Medium", "Planned", "earning and deduction ordering mistakes that break net pay"],
  ["Payroll Accounting", "Reconciliation", "Advanced", "High", "Published", "gross-to-net reconciliation patterns that survive a close"],
  ["Payroll Accounting", "Reconciliation", "Expert", "High", "Planned", "payroll-to-GL tie-out when cost centers move"],
  ["Payroll Accounting", "Architecture", "Advanced", "Medium", "Planned", "payroll accounting rules and journal posting design"],
  ["Payroll Accounting", "Close", "Advanced", "High", "Planned", "period close sequencing and what blocks it"],
  ["Payroll Reporting", "Reporting", "Intermediate", "High", "Published", "payroll reporting essentials before you run"],
  ["Payroll Reporting", "Reporting", "Advanced", "High", "Planned", "building a defensible pay results audit report"],
  ["Payroll Reporting", "Reporting", "Advanced", "Medium", "Planned", "RaaS feeds for downstream payroll analytics"],
  ["Payroll Reporting", "Audit", "Advanced", "High", "Planned", "the reports an auditor asks for on a payroll run"],
  ["Payroll Audits", "Audit", "Advanced", "High", "Planned", "payroll audit checklist for a tenant assessment"],
  ["Payroll Audits", "Compliance", "Expert", "High", "Planned", "statutory compliance checks across pay countries"],
  ["Payroll Audits", "Governance", "Advanced", "Medium", "Planned", "audit ownership and recurring control reports"],
  ["Payroll Interface", "Integration", "Advanced", "High", "Published", "payroll interface design for third-party processors"],
  ["Payroll Interface", "Integration", "Expert", "High", "Planned", "PICOF / PECI mapping decisions that age badly"],
  ["Payroll Interface", "Troubleshooting", "Advanced", "Medium", "Planned", "diagnosing a failed outbound payroll interface"],
  ["Third-Party Payroll Integrations", "Integration", "Advanced", "High", "Planned", "third-party payroll integration failure modes"],
  ["Third-Party Payroll Integrations", "Integration", "Expert", "Medium", "Planned", "tax engine and net-pay round-trip integration"],
  ["Global Payroll Cloud", "Architecture", "Expert", "High", "Published", "Global Payroll Cloud vs. Workday Payroll design tradeoffs"],
  ["Global Payroll Cloud", "Configuration", "Advanced", "High", "Planned", "configuring country packages in Global Payroll Cloud"],
  ["Global Payroll Cloud", "Compliance", "Advanced", "Medium", "Planned", "localization and statutory rule maintenance"],
  ["Global Payroll Cloud", "Governance", "Advanced", "Medium", "Planned", "release impact review for global payroll"],
  ["Workday Payroll (US, UK, Canada, France)", "Compliance", "Advanced", "High", "Planned", "year-end and statutory filing readiness"],
];

// A small slice of other modules so the role selector demonstrably re-filters.
const OTHER_SEED = [
  ["Security & Compliance", "Domain Security", "Security", "Advanced", "High", "Published", "security group design and org scoping"],
  ["Security & Compliance", "Domain Security", "Governance", "Advanced", "High", "Planned", "security change control and recertification"],
  ["Security & Compliance", "Business Process Security", "Security", "Expert", "High", "Planned", "BP security policies that over-grant access"],
  ["Analytics & Reporting", "Custom Reports", "Reporting", "Intermediate", "High", "Published", "advanced report writing patterns"],
  ["Analytics & Reporting", "Custom Reports", "Reporting", "Advanced", "Medium", "Planned", "calculated fields you will regret building"],
  ["Analytics & Reporting", "RaaS", "Integration", "Advanced", "High", "Planned", "RaaS as an integration source done right"],
];

let _seq = 0;
function row(module, sub, focus, diff, weight, status, suffix, codePrefix) {
  _seq += 1;
  const code = `${codePrefix}-KB-${String(_seq).padStart(3, "0")}`;
  return {
    kb_id: code,
    document_id: code,
    title: `${sub}: ${suffix}`,
    module,
    sub_module: sub,
    technical_focus: focus,
    difficulty: diff,
    target_roles: "Workday Payroll Consultant; Senior HRIS Analyst; Workday HCM Consultant",
    interview_weight: weight,
    status,
    source_url: `${URL}/${code}`,
  };
}

export const KB_REGISTRY = [
  ...PAYROLL_SEED.map(([sub, f, d, w, s, suf]) => row("Payroll", sub, f, d, w, s, suf, "PAY")),
  ...OTHER_SEED.map(([mod, sub, f, d, w, s, suf]) => row(mod, sub, f, d, w, s, suf, "GEN")),
];

export default KB_REGISTRY;

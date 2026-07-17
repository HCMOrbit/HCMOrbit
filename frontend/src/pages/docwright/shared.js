/**
 * Docwright — shared constants + hooks.
 * The dropdown lists come from GET /api/docwright/config so backend and
 * frontend can never drift out of sync.
 */
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export const FALLBACK_MODULES = [
  "Core HCM", "Payroll", "Absence", "Time Tracking", "Benefits",
  "Recruiting", "Talent", "Security", "Integrations", "Reporting", "Financials",
];
export const FALLBACK_DOC_TYPES = [
  "Configuration Design Document", "Design Decision Log", "Tenant Configuration Summary",
];
export const FALLBACK_PHASES = ["Architect", "Configure & Prototype", "Test", "Deploy"];

// Section keys must match services/docwright/generator.py SECTION_KEYS exactly.
export const SECTION_ORDER = [
  { key: "document_control",         label: "Document Control" },
  { key: "purpose_scope",            label: "Purpose & Scope" },
  { key: "business_requirements",    label: "Business Requirements" },
  { key: "design_decisions",         label: "Design Decisions" },
  { key: "configuration_detail",     label: "Configuration Detail" },
  { key: "assumptions_dependencies", label: "Assumptions & Dependencies" },
  { key: "open_items",               label: "Open Items / Parking Lot" },
  { key: "testing_considerations",   label: "Testing Considerations" },
  { key: "approvals",                label: "Approvals" },
];

export function useDocwrightConfig() {
  const [config, setConfig] = useState({
    modules: FALLBACK_MODULES, doc_types: FALLBACK_DOC_TYPES, phases: FALLBACK_PHASES,
  });
  useEffect(() => {
    let cancelled = false;
    api.get("/docwright/config").then((r) => { if (!cancelled) setConfig(r.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return config;
}

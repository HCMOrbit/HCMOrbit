import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

/**
 * KBLink — single guide link row used inside a phase card.
 *
 * Props:
 *  - guide:    { docId: string, title: string }
 *  - onSelect: optional override; when provided, renders as a button that
 *              calls onSelect(guide) instead of navigating.
 *
 * Default behavior routes to `/knowledge-base/by-ref/{docId}` which is
 * resolved by KBRefResolver → GET /api/kb/by-ref/{reference_id} →
 * redirect to the real KB doc page. If the ref does not exist, the
 * resolver surfaces the "not found" error inline (no dead links).
 */
export default function KBLink({ guide, onSelect }) {
  if (!guide) return null;

  const inner = (
    <>
      <FileText className="w-4 h-4 shrink-0" style={{ color: "#1DB589" }} />
      <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "#0d1b2a" }}>
        {guide.title}
      </span>
      <span
        className="text-[11px] shrink-0"
        style={{
          color: "#888",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          letterSpacing: "0.4px",
        }}
      >
        {guide.docId}
      </span>
    </>
  );

  const commonProps = {
    "data-testid": `career-kb-link-${guide.docId}`,
    className:
      "w-full flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors hover:bg-[#f7f8fa] no-underline",
    style: { border: "1px solid #f0f0f0", background: "#ffffff", cursor: "pointer" },
  };

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(guide)} {...commonProps}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={`/knowledge-base/by-ref/${encodeURIComponent(guide.docId)}`} {...commonProps}>
      {inner}
    </Link>
  );
}

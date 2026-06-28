import React from "react";
import { FileText } from "lucide-react";

/**
 * KBLink — single guide link row used inside a phase card.
 *
 * Props:
 *  - guide:    { docId: string, title: string }
 *  - onSelect: optional override; default behavior is console.log(docId).
 *
 * The real KB article route is wired in a follow-up phase; do NOT guess a URL.
 */
export default function KBLink({ guide, onSelect }) {
  if (!guide) return null;
  const handleClick = () => {
    if (onSelect) { onSelect(guide); return; }
    console.log("KB link:", guide.docId);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={`career-kb-link-${guide.docId}`}
      className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-md transition-colors hover:bg-[#f7f8fa]"
      style={{ border: "1px solid #f0f0f0", background: "#ffffff", cursor: "pointer" }}
    >
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
    </button>
  );
}

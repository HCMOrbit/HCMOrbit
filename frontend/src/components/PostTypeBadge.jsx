import React from "react";

const VARIANTS = {
  question: { bg: "bg-[#1D6FE8]/8", text: "text-[#1D6FE8]", border: "border-[#1D6FE8]/20", label: "Question" },
  discussion: { bg: "bg-[#7C3AED]/8", text: "text-[#7C3AED]", border: "border-[#7C3AED]/20", label: "Discussion" },
  success_story: { bg: "bg-[#16A34A]/8", text: "text-[#16A34A]", border: "border-[#16A34A]/20", label: "Success Story" },
};

export default function PostTypeBadge({ type }) {
  const v = VARIANTS[type] || VARIANTS.discussion;
  return (
    <span
      data-testid={`post-type-${type}`}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${v.bg} ${v.text} ${v.border}`}
    >
      {v.label}
    </span>
  );
}

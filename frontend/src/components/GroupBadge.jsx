import React from "react";

const VARIANTS = {
  aspirant: { bg: "bg-[#0D9373]/10", text: "text-[#0D9373]", border: "border-[#0D9373]/20", label: "Aspirant" },
  practitioner: { bg: "bg-[#1D6FE8]/10", text: "text-[#1D6FE8]", border: "border-[#1D6FE8]/20", label: "Practitioner" },
  employer: { bg: "bg-[#C47B0A]/10", text: "text-[#C47B0A]", border: "border-[#C47B0A]/20", label: "Employer" },
};

export default function GroupBadge({ group, size = "sm" }) {
  if (!group || !VARIANTS[group]) return null;
  const v = VARIANTS[group];
  const sz = size === "lg"
    ? "px-3 py-1 text-sm"
    : "px-2 py-0.5 text-xs";
  return (
    <span
      data-testid={`group-badge-${group}`}
      className={`inline-flex items-center rounded-full font-medium border ${v.bg} ${v.text} ${v.border} ${sz}`}
    >
      {v.label}
    </span>
  );
}

import React from "react";

/**
 * StatRow — 4 compact stat tiles used at the bottom of dashboard-style tabs.
 *
 * Props:
 *  - items: Array<{ label: string, value: string|number }>
 */
export default function StatRow({ items = [] }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      data-testid="career-stat-row"
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-white rounded-xl px-4 py-4"
          style={{ border: "1px solid #eaeaea" }}
          data-testid={`career-stat-${it.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          <div
            className="text-[10px] font-semibold mb-1.5"
            style={{ color: "#888", letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            {it.label}
          </div>
          <div className="text-2xl font-bold leading-none" style={{ color: "#0d1b2a" }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

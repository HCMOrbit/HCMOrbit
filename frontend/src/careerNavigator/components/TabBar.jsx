import React from "react";

const TABS = [
  { id: "home",         label: "Home" },
  { id: "paths",        label: "Career paths" },
  { id: "interview",    label: "Interview prep" },
];

/**
 * TabBar — pill tabs for the Career Navigator.
 * Active pill: teal background, navy text. Inactive: white, 1px #eaeaea border.
 *
 * Props:
 *  - value:    active tab id
 *  - onChange: (tabId) => void
 */
export default function TabBar({ value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Career navigator sections"
      data-testid="career-navigator-tabbar"
      className="flex flex-wrap gap-2 mt-5"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`career-tab-${t.id}`}
            onClick={() => onChange?.(t.id)}
            className="text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB589]/60"
            style={{
              padding: "8px 16px",
              borderRadius: 9999,
              background: active ? "#1DB589" : "#ffffff",
              color: active ? "#0a1628" : "#0d1b2a",
              border: active ? "1px solid #1DB589" : "1px solid #eaeaea",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export { TABS };

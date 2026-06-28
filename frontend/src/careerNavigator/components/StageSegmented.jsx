import React, { useEffect, useRef } from "react";
import { STAGES } from "../data";

/**
 * StageSegmented — 3-segment pill control driven by STAGES.
 *
 * Active segment uses inline `setProperty(..., 'important')` so the global
 * button theme cannot override the resting state.
 *
 * Props:
 *  - value:    active stage id (e.g. "leveling-up")
 *  - onChange: (stageId) => void
 *  - testId:   optional override for the wrapper test id
 */
export default function StageSegmented({ value, onChange, testId = "career-stage-segmented" }) {
  // Track refs for each segment so we can re-apply resting styles whenever
  // `value` changes (active/inactive swap).
  const refs = useRef({});

  useEffect(() => {
    STAGES.forEach((s) => {
      const el = refs.current[s.id];
      if (!el) return;
      if (s.id === value) {
        el.style.setProperty("background", "#0a1628", "important");
        el.style.setProperty("color", "#ffffff", "important");
        el.style.setProperty("border", "1px solid #0a1628", "important");
      } else {
        el.style.setProperty("background", "#ffffff", "important");
        el.style.setProperty("color", "#0a1628", "important");
        el.style.setProperty("border", "1px solid #eaeaea", "important");
      }
    });
  }, [value]);

  return (
    <div
      role="tablist"
      aria-label="Career stage"
      data-testid={testId}
      style={{ display: "inline-flex", gap: 6 }}
    >
      {STAGES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={value === s.id}
          ref={(el) => { refs.current[s.id] = el; }}
          onClick={() => onChange?.(s.id)}
          data-testid={`career-stage-${s.id}`}
          className="text-[12px] font-semibold"
          style={{
            padding: "6px 12px",
            borderRadius: 9999,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

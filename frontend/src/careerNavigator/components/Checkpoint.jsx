import React, { useEffect, useRef } from "react";
import { Target } from "lucide-react";

/**
 * Checkpoint — small chip rendered at the bottom of a phase card.
 *
 * Props:
 *  - label: string  — the checkpoint sentence (without the "Checkpoint:" prefix).
 *
 * Uses setProperty(..., 'important') for resting styles so the global button
 * theme cannot flatten the chip.
 */
export default function Checkpoint({ label }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("background", "rgba(245,183,49,0.12)", "important");
    el.style.setProperty("color", "#8a5a00", "important");
    el.style.setProperty("border", "1px solid rgba(245,183,49,0.4)", "important");
  }, []);
  return (
    <div
      ref={ref}
      data-testid="career-phase-checkpoint"
      className="inline-flex items-center gap-2 text-[12px] font-medium"
      style={{
        padding: "5px 10px",
        borderRadius: 9999,
      }}
    >
      <Target className="w-3.5 h-3.5" />
      <span>Checkpoint: {label}</span>
    </div>
  );
}

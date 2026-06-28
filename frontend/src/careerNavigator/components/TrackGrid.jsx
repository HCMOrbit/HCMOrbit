import React from "react";
import {
  Banknote, Building2, Plug, Lock, BarChart3, UserPlus, Heart, CalendarDays, ArrowRight,
} from "lucide-react";
import { TRACKS } from "../data";

const ICONS = {
  cash: Banknote,
  building: Building2,
  plug: Plug,
  lock: Lock,
  chart: BarChart3,
  userplus: UserPlus,
  heart: Heart,
  calendar: CalendarDays,
};

/**
 * TrackGrid — 2-column responsive grid showing all 8 TRACKS.
 *
 * Props:
 *  - onPickTrack: (trackId) => void  — called when a card is clicked.
 *
 * Visual:
 *  - Standard card: 1px #eaeaea border, white background.
 *  - popular:true   → 2px solid #1DB589 border + small "POPULAR" chip.
 */
export default function TrackGrid({ onPickTrack }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3" data-testid="career-track-grid">
      {TRACKS.map((t) => {
        const Icon = ICONS[t.icon] || Banknote;
        const isPop = !!t.popular;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPickTrack?.(t.id)}
            data-testid={`career-track-${t.id}`}
            className="text-left bg-white rounded-xl p-4 transition-colors"
            style={{
              border: isPop ? "2px solid #1DB589" : "1px solid #eaeaea",
              cursor: "pointer",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center"
                style={{ background: "rgba(29,181,137,0.10)", color: "#1DB589" }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold" style={{ color: "#0d1b2a" }}>
                    {t.name}
                  </span>
                  {isPop && (
                    <span
                      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(29,181,137,0.14)", color: "#117a5c", letterSpacing: "0.8px" }}
                      data-testid={`career-track-${t.id}-popular-chip`}
                    >
                      POPULAR
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] leading-relaxed mb-2" style={{ color: "#666" }}>
                  {t.blurb}
                </p>
                <div className="text-[11.5px]" style={{ color: "#888" }}>
                  Analyst → Architect · {t.guideCount} guides
                </div>
              </div>
              <ArrowRight className="w-4 h-4 mt-1 shrink-0" style={{ color: "#888" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

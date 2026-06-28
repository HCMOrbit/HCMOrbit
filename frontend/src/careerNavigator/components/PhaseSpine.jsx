import React from "react";
import KBLink from "./KBLink";
import Checkpoint from "./Checkpoint";

/**
 * PhaseSpine — vertical numbered spine for a track's phases.
 *
 * Props:
 *  - phases: Array<{
 *      n: number, title: string, timeframe: string, summary: string,
 *      guides?: Array<{docId, title}>, checkpoint?: string
 *    }>
 *
 * Visual:
 *  - Numbered teal dots on the left, connected by a vertical line.
 *  - The last dot has no trailing line.
 *  - Each phase: title + timeframe pill, summary, KBLinks for each guide,
 *    then a Checkpoint chip.
 */
export default function PhaseSpine({ phases = [] }) {
  if (!phases.length) return null;
  return (
    <ol className="relative" data-testid="career-phase-spine">
      {phases.map((p, i) => {
        const isLast = i === phases.length - 1;
        return (
          <li
            key={p.n ?? i}
            data-testid={`career-phase-${p.n ?? i + 1}`}
            className="relative pl-12 pb-6 last:pb-0"
          >
            {/* Connector line (skip for last) */}
            {!isLast && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 15,
                  top: 32,
                  bottom: 0,
                  width: 2,
                  background: "#e6e6e6",
                }}
              />
            )}
            {/* Numbered dot */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 inline-flex items-center justify-center text-[12px] font-bold"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                background: "#1DB589",
                color: "#ffffff",
                boxShadow: "0 0 0 4px #ffffff",
              }}
            >
              {p.n ?? i + 1}
            </span>

            {/* Card */}
            <div
              className="rounded-xl bg-white p-4"
              style={{ border: "1px solid #eaeaea" }}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h4 className="text-[14px] font-semibold" style={{ color: "#0d1b2a" }}>
                  {p.title}
                </h4>
                {p.timeframe && (
                  <span
                    className="text-[11px] font-medium shrink-0"
                    style={{
                      color: "#666",
                      background: "#f4f4f4",
                      borderRadius: 9999,
                      padding: "3px 10px",
                    }}
                  >
                    {p.timeframe}
                  </span>
                )}
              </div>
              {p.summary && (
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#555" }}>
                  {p.summary}
                </p>
              )}
              {Array.isArray(p.guides) && p.guides.length > 0 && (
                <div className="space-y-2 mb-3">
                  {p.guides.map((g) => <KBLink key={g.docId} guide={g} />)}
                </div>
              )}
              {p.checkpoint && <Checkpoint label={p.checkpoint} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

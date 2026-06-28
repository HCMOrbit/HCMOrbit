import React, { useState } from "react";
import { Compass } from "lucide-react";
import TrackGrid from "../components/TrackGrid";
import StageSegmented from "../components/StageSegmented";

// Apply resting styles via setProperty(..., 'important') so global button
// themes cannot flatten the path-finder button.
const setFinderRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#ffffff", "important");
  el.style.setProperty("color", "#0d1b2a", "important");
  el.style.setProperty("border", "1px solid #eaeaea", "important");
};

/**
 * PathsTab — "Career paths" tab.
 *
 * Local state:
 *  - stage: which life-stage to scope the roadmap to (default "leveling-up").
 *
 * Props:
 *  - onPickTrack(trackId, stage)  — called when a track card is clicked; the
 *    parent stores roadmap={trackId, stage}.
 */
function PathsTab({ onPickTrack }) {
  const [stage, setStage] = useState("leveling-up");

  return (
    <div className="mt-6 space-y-6" data-testid="career-paths-tab">
      <div
        className="rounded-xl bg-white p-6"
        style={{ border: "1px solid #eaeaea" }}
      >
        {/* Card header: title + stage segmented in the top-right */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="text-base font-semibold" style={{ color: "#0d1b2a" }}>
            Pick your track
          </h2>
          <StageSegmented value={stage} onChange={setStage} />
        </div>

        <TrackGrid
          onPickTrack={(trackId) => {
            console.log("[PathsTab] roadmap set:", { trackId, stage });
            onPickTrack?.(trackId, stage);
          }}
        />

        {/* Footer row */}
        <div
          className="mt-5 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ borderTop: "1px solid #f0f0f0" }}
        >
          <p className="text-[12.5px]" style={{ color: "#888" }}>
            Not sure yet? Answer a few questions and we&apos;ll point you at the closest fit.
          </p>
          <button
            type="button"
            ref={setFinderRest}
            data-testid="career-paths-finder-button"
            className="inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-md"
            style={{ fontWeight: 500 }}
          >
            <Compass className="w-3.5 h-3.5" />
            Take the 2-minute path finder
          </button>
        </div>
      </div>
    </div>
  );
}

PathsTab.heroProps = {
  eyebrow: "Career paths",
  title: "Where are you headed?",
  subtitle: "Eight Workday tracks, three career stages. Pick the closest fit and we'll build a phased roadmap around it.",
  rightPill: null,
};

export default PathsTab;

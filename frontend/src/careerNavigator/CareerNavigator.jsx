import React, { useState } from "react";
import NavHeader from "../components/NavHeader";
import HeroMast from "./components/HeroMast";
import TabBar from "./components/TabBar";

/**
 * CareerNavigator — Phase 1 shell.
 *
 * Holds two pieces of state:
 *  - tab:     active tab id (default "home")
 *  - roadmap: selected roadmap object (default null) — wired in later phases
 *
 * Renders the masthead, tab bar, and a placeholder area that reflects the
 * active tab. Actual tab content arrives in later phases.
 */
export default function CareerNavigator() {
  const [tab, setTab] = useState("home");
  const [roadmap, setRoadmap] = useState(null); // reserved for later phases

  return (
    <div className="min-h-screen" style={{ background: "#f7f8fa" }} data-testid="career-navigator-page">
      <NavHeader />
      <main className="mx-auto px-4 sm:px-6 py-8" style={{ maxWidth: 960 }}>
        <HeroMast
          eyebrow="Career navigator"
          title="Find your next move in Workday."
          subtitle="Pick a path, prep for interviews, and read the industry — all from one place."
        />
        <TabBar value={tab} onChange={setTab} />
        <div
          className="mt-6 rounded-xl bg-white p-6 text-sm"
          style={{ border: "1px solid #eaeaea", color: "#555" }}
          data-testid="career-navigator-placeholder"
          data-roadmap={roadmap ? "set" : "none"}
          onClick={() => setRoadmap(roadmap)}
        >
          {tab}
        </div>
      </main>
    </div>
  );
}

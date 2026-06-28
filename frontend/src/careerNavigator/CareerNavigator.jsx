import React, { useState } from "react";
import NavHeader from "../components/NavHeader";
import HeroMast from "./components/HeroMast";
import TabBar from "./components/TabBar";
import HomeTab from "./tabs/HomeTab";

/**
 * CareerNavigator — page shell.
 *
 * Holds two pieces of state:
 *  - tab:     active tab id (default "home")
 *  - roadmap: { trackId, stage } | null — seeded from home/role clicks
 */
export default function CareerNavigator() {
  const [tab, setTab] = useState("home");
  const [roadmap, setRoadmap] = useState(null);

  const handlePickRole = (trackId) => {
    setRoadmap({ trackId, stage: "leveling-up" });
    // Other tabs that consume `roadmap` arrive in Phase 4.
  };

  // Default hero props (shown for tabs that don't override).
  let heroProps = {
    eyebrow: "Career navigator",
    title: "Find your next move in Workday.",
    subtitle: "Pick a path, prep for interviews, and read the industry — all from one place.",
    rightPill: null,
    heroChildren: null,
  };

  if (tab === "home") {
    heroProps = {
      ...HomeTab.heroProps,
      heroChildren: <HomeTab.HeroContent onSetTab={setTab} onPickRole={handlePickRole} />,
    };
  }

  return (
    <div className="min-h-screen" style={{ background: "#f7f8fa" }} data-testid="career-navigator-page">
      <NavHeader />
      <main className="mx-auto px-4 sm:px-6 py-8" style={{ maxWidth: 960 }}>
        <HeroMast
          eyebrow={heroProps.eyebrow}
          title={heroProps.title}
          subtitle={heroProps.subtitle}
          rightPill={heroProps.rightPill}
        >
          {heroProps.heroChildren}
        </HeroMast>
        <TabBar value={tab} onChange={setTab} />

        {tab === "home" && <HomeTab onSetTab={setTab} />}

        {tab !== "home" && (
          <div
            className="mt-6 rounded-xl bg-white p-6 text-sm"
            style={{ border: "1px solid #eaeaea", color: "#555" }}
            data-testid="career-navigator-placeholder"
            data-roadmap={roadmap ? "set" : "none"}
          >
            {tab}
          </div>
        )}
      </main>
    </div>
  );
}

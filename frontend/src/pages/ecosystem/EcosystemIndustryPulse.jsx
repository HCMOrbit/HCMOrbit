import React from "react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import IndustryTab from "../../careerNavigator/tabs/IndustryTab";

/**
 * Standalone Industry Pulse page under /ecosystem/industry-pulse.
 * Wraps the same IndustryTab component used inside Career Hub so the two
 * surfaces stay visually and functionally identical.
 */
export default function EcosystemIndustryPulse() {
  return (
    <>
      <NavHeader />
      <EcosystemSubpageHero
        eyebrow="Industry pulse"
        title="Where Workday is moving"
        description="Demand signals, hot modules, and recent go-lives — read the industry before you pick your next move."
        current="Industry Pulse"
      />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8 lg:py-10" data-testid="ecosystem-industry-pulse-page">
        <IndustryTab />
      </main>
    </>
  );
}

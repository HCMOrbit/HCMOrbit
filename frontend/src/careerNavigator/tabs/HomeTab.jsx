import React from "react";
import {
  Banknote, Building2, Plug, Lock, BarChart3, UserPlus, Heart, CalendarDays,
  ArrowRight, Map, MessageSquare,
} from "lucide-react";
import { TRACKS } from "../data";
import StatRow from "../components/StatRow";

// Map our data-icon tokens to lucide-react icon components.
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

function RolePanel({ onPickRole }) {
  const roles = TRACKS.slice(0, 6);
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
      data-testid="career-home-role-panel"
    >
      <div
        className="text-[10px] font-semibold mb-3"
        style={{ color: "#1DB589", letterSpacing: "1.2px", textTransform: "uppercase" }}
      >
        Explore by role
      </div>
      <ul className="space-y-1">
        {roles.map((t) => {
          const Icon = ICONS[t.icon] || Banknote;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPickRole(t.id)}
                data-testid={`career-home-role-${t.id}`}
                className="w-full flex items-center gap-2.5 text-left text-[13px] font-medium px-2.5 py-2 rounded-md transition-colors hover:bg-white/10"
                style={{ color: "#ffffff" }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: "#1DB589" }} />
                <span className="flex-1 truncate">{t.name}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-50" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EntryCard({ topBarColor, icon: Icon, eyebrow, title, body, buttonLabel, buttonBg, buttonColor, onClick, testId }) {
  return (
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: "1px solid #eaeaea" }}
      data-testid={testId}
    >
      <div style={{ height: 4, background: topBarColor }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" style={{ color: topBarColor }} />
          <div
            className="text-[10px] font-semibold"
            style={{ color: topBarColor, letterSpacing: "1.2px", textTransform: "uppercase" }}
          >
            {eyebrow}
          </div>
        </div>
        <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: "#0d1b2a" }}>
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#666" }}>
          {body}
        </p>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-md transition-opacity hover:opacity-90"
          style={{ background: buttonBg, color: buttonColor }}
          data-testid={`${testId}-button`}
        >
          {buttonLabel} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * HomeTab — main landing content for the Career Navigator "Home" tab.
 *
 * Props:
 *  - onSetTab(tabId)         — switch parent's active tab
 *  - onPickRole(trackId)     — seed a roadmap from a role click
 *  - heroExtras              — render-prop-free escape hatch; instead we expose
 *                               `renderHero` so the parent can place the right
 *                               panel + CTAs INSIDE the existing HeroMast.
 *
 * In this implementation HomeTab provides:
 *   - HomeTab.HeroContent({ onSetTab, onPickRole }) — to place inside HeroMast children
 *   - HomeTab default export  — content rendered below the masthead
 */
function HomeTabBody({ onSetTab }) {
  return (
    <div className="mt-6 space-y-6" data-testid="career-home-tab">
      {/* Two entry cards inside a single white card with heading */}
      <div
        className="rounded-xl bg-white p-6"
        style={{ border: "1px solid #eaeaea" }}
        data-testid="career-home-entry-card"
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "#0d1b2a" }}>
          Choose where to start
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <EntryCard
            testId="career-home-entry-roadmap"
            topBarColor="#1DB589"
            icon={Map}
            eyebrow="Roadmap"
            title="Follow a roadmap"
            body="Pick a track, see the phases, and work through curated guides at your level."
            buttonLabel="Browse career paths"
            buttonBg="#0a1628"
            buttonColor="#ffffff"
            onClick={() => onSetTab("paths")}
          />
          <EntryCard
            testId="career-home-entry-interview"
            topBarColor="#F5B731"
            icon={MessageSquare}
            eyebrow="Interview"
            title="Prep for an interview"
            body="Core questions, scenario drills, and module-specific failure patterns to rehearse."
            buttonLabel="Open interview prep"
            buttonBg="#1DB589"
            buttonColor="#ffffff"
            onClick={() => onSetTab("interview")}
          />
        </div>
      </div>

      <StatRow
        items={[
          { label: "Tracks started", value: "—" },
          { label: "Articles read",  value: "—" },
          { label: "Checkpoints",    value: "—" },
          { label: "Milestones",     value: "0" },
        ]}
      />
    </div>
  );
}

// Hero content (right pill + role panel + CTA buttons) is exposed as a static
// helper so the parent can drop it inside the existing HeroMast component.
HomeTabBody.HeroContent = function HomeHeroContent({ onSetTab, onPickRole }) {
  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-5 items-start">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onSetTab("paths")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-md transition-opacity hover:opacity-90"
          style={{ background: "#1DB589", color: "#ffffff" }}
          data-testid="career-home-cta-find"
        >
          Find my path <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onSetTab("paths")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-md transition-colors hover:bg-white/10"
          style={{ background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.55)" }}
          data-testid="career-home-cta-starting"
        >
          I&apos;m just starting
        </button>
      </div>
      <RolePanel onPickRole={onPickRole} />
    </div>
  );
};

HomeTabBody.heroProps = {
  eyebrow: "Plan your path",
  title: "Become a Workday pro",
  subtitle: "Roadmaps, interview prep, and industry signals — built around how Workday work actually evolves.",
  rightPill: (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-3 py-1.5 rounded-full"
      style={{ background: "rgba(29,181,137,0.18)", color: "#1DB589", border: "1px solid rgba(29,181,137,0.35)" }}
      data-testid="career-home-pill"
    >
      8 tracks · 120+ guides
    </span>
  ),
};

export default HomeTabBody;

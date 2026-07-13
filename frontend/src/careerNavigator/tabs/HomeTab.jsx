import React from "react";
import {
  Banknote, Building2, Plug, Lock, BarChart3, UserPlus, Heart, CalendarDays,
  ArrowRight, Map, MessageSquare,
} from "lucide-react";
import { TRACKS } from "../data";

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

function RoleStrip({ onPickRole }) {
  return (
    <div
      className="mt-5 pt-4"
      style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
      data-testid="career-home-role-strip"
    >
      <div
        className="text-[10px] font-semibold mb-3"
        style={{ color: "#1DB589", letterSpacing: "1.2px", textTransform: "uppercase" }}
      >
        Explore by role
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {TRACKS.map((t) => {
          const Icon = ICONS[t.icon] || Banknote;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPickRole(t.id)}
              data-testid={`career-home-role-${t.id}`}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              className="inline-flex items-center gap-2 text-[12px] font-medium"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 9999,
                padding: "6px 12px",
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: "#1DB589" }} />
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>
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

      {/* Progress stats row hidden until tracks-started / articles-read /
          checkpoints / milestones progress tracking is wired end-to-end. */}
    </div>
  );
}

// Apply resting styles via setProperty(..., 'important') so no global button
// theme can override them. React's `style` prop does not support !important.
const setFindRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#1DB589", "important");
  el.style.setProperty("color", "#0a1628", "important");
  el.style.setProperty("border", "none", "important");
};
const setStartRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "rgba(255,255,255,0.1)", "important");
  el.style.setProperty("color", "#ffffff", "important");
  el.style.setProperty("border", "1px solid rgba(255,255,255,0.55)", "important");
};

// Hero content (CTA buttons + horizontal role strip) is exposed as a static
// helper so the parent can drop it inside the existing HeroMast component.
HomeTabBody.HeroContent = function HomeHeroContent({ onSetTab, onPickRole }) {
  return (
    <div data-testid="career-home-hero-content">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          ref={setFindRest}
          onClick={() => onSetTab("paths")}
          onMouseEnter={(e) => { e.currentTarget.style.setProperty("background", "#17a07a", "important"); }}
          onMouseLeave={(e) => { e.currentTarget.style.setProperty("background", "#1DB589", "important"); }}
          className="inline-flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-md"
          style={{ fontWeight: 500 }}
          data-testid="career-home-cta-find"
        >
          Find my path <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          ref={setStartRest}
          onClick={() => onSetTab("paths")}
          onMouseEnter={(e) => { e.currentTarget.style.setProperty("background", "rgba(255,255,255,0.18)", "important"); }}
          onMouseLeave={(e) => { e.currentTarget.style.setProperty("background", "rgba(255,255,255,0.1)", "important"); }}
          className="inline-flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-md"
          style={{ fontWeight: 500 }}
          data-testid="career-home-cta-starting"
        >
          I&apos;m just starting
        </button>
      </div>
      <RoleStrip onPickRole={onPickRole} />
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

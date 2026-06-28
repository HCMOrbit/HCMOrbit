import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Sparkles, UserSearch, Briefcase, Users, Building2,
  ClipboardCheck, FileText, ListChecks, Table2, AlertTriangle, CheckCircle2,
} from "lucide-react";
import NavHeader from "../components/NavHeader";

// --- Tokens (matched to spec) -----------------------------------------------
const C = {
  navy: "#0a1628",
  navyEnd: "#0d2d3a",
  green: "#1DB589",
  bg: "#f7f8fa",
  card: "#ffffff",
  border: "#eaeaea",
  borderSoft: "#f0f0f0",
  text: "#0d1b2a",
  textMuted: "#888888",
  textDim: "#666666",
};

// --- Small primitives -------------------------------------------------------
function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase font-semibold mb-4" style={{ letterSpacing: "1.2px", color: C.green }}>
      {children}
    </div>
  );
}

function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={`bg-white rounded-xl ${className}`}
      style={{ border: `1px solid ${C.border}` }}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4" style={{ color: C.text }} />}
        <h3 className="text-[13px] font-semibold" style={{ color: C.text }}>{title}</h3>
      </div>
      {action}
    </div>
  );
}

// --- 1) Choose your path ----------------------------------------------------
const PATHS = [
  { Icon: UserSearch, color: "#1DB589", bg: "rgba(29,181,137,0.10)", title: "Job seekers", body: "Interview prep, resume lab, role-based learning paths" },
  { Icon: Briefcase,  color: "#3B82F6", bg: "rgba(59,130,246,0.10)", title: "Consultants", body: "Architect-level Qs, freelance rates, specialization strategy" },
  { Icon: Users,      color: "#F59E0B", bg: "rgba(245,158,11,0.10)", title: "Hiring managers", body: "JD templates, scorecards, skill validation guides" },
  { Icon: Building2,  color: "#F43F5E", bg: "rgba(244,63,94,0.10)", title: "Firms & recruiters", body: "Attract talent, clarify roles, position in the market" },
];

function PathCard({ Icon, color, bg, title, body }) {
  return (
    <Card className="p-5 transition-colors hover:border-[#1DB589]" data-testid={`career-path-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: bg, color }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-[13px] font-semibold mb-1" style={{ color: C.text }}>{title}</div>
      <div className="text-[12px] leading-relaxed" style={{ color: C.textDim }}>{body}</div>
    </Card>
  );
}

// --- 2) Interview prep by level --------------------------------------------
const LEVELS = [
  { label: "Beginner",   bg: "rgba(29,181,137,0.12)", color: "#1DB589", desc: "Core HCM basics, terminology, scenarios", qs: 12 },
  { label: "Analyst",    bg: "rgba(59,130,246,0.12)", color: "#2563EB", desc: "Reports, security, config, support tickets", qs: 28 },
  { label: "Consultant", bg: "rgba(139,92,246,0.12)", color: "#7C3AED", desc: "Design decisions, testing, client scenarios", qs: 34 },
  { label: "Lead",       bg: "rgba(245,158,11,0.12)", color: "#B45309", desc: "Governance, cross-module impact, stakeholders", qs: 19 },
  { label: "Architect",  bg: "rgba(244,63,94,0.12)",  color: "#BE123C", desc: "Tenant strategy, integrations, security", qs: 22 },
];

const RESUME_CHECKS = [
  "Resume examples by role — analyst, lead, consultant, architect",
  "How to write impact bullets for Workday implementations",
  "LinkedIn headline templates for Workday practitioners",
  "Workday keyword bank by module",
  "Positioning transferable HRIS experience (SAP, UKG, SF)",
];

// --- 3) Hiring leader toolkit ----------------------------------------------
const HIRING_TOOLS = [
  { Icon: FileText,      label: "JD templates by module" },
  { Icon: ClipboardCheck, label: "Interview scorecards" },
  { Icon: Table2,         label: "Skills matrix by module" },
  { Icon: AlertTriangle,  label: "Resume red flags" },
];

// --- 4) Ecosystem explorer pills -------------------------------------------
const ECOSYSTEM_PILLS = [
  { label: "Customers", count: "4,200+" },
  { label: "SI Partners", count: "180+" },
  { label: "Healthcare", count: "620+" },
  { label: "Higher Ed", count: "390+" },
  { label: "Remote roles tracked" },
];

// --- Page -------------------------------------------------------------------
export default function CareerHub() {
  return (
    <div className="min-h-screen" style={{ background: C.bg }} data-testid="career-hub-page">
      <NavHeader />

      {/* HERO — dark navy gradient ------------------------------------------ */}
      <section
        className="text-white"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyEnd} 100%)` }}
        data-testid="career-hero"
      >
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 lg:py-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: C.green }} />
            Career intelligence for the Workday ecosystem
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] max-w-4xl">
            The Hub Where Workday Professionals{" "}
            <span style={{ color: C.green }}>Find, Grow,</span>{" "}
            and Get Hired.
          </h1>

          <p className="mt-4 max-w-2xl text-base lg:text-lg text-white/70 leading-relaxed">
            Interview prep, resume guidance, hiring toolkits, and ecosystem maps — for practitioners at every level and the teams that hire them.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/career-hub#interview-prep"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-[14px] font-semibold transition-colors"
              style={{ background: C.green, color: "white" }}
              data-testid="hero-prepare-interviews"
            >
              Prepare for interviews <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/career-hub#hiring"
              className="inline-flex items-center px-5 py-3 rounded-md text-[14px] font-semibold transition-colors"
              style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.55)" }}
              data-testid="hero-im-hiring"
            >
              I&apos;m hiring Workday talent
            </Link>
          </div>

          <p className="mt-5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Built by a Workday practitioner with 17+ years of enterprise HCM experience
          </p>
        </div>
      </section>

      {/* BODY ---------------------------------------------------------------- */}
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-8 space-y-6">

        {/* 1) CHOOSE YOUR PATH ------------------------------------------- */}
        <section data-testid="career-paths">
          <SectionLabel>Choose your path</SectionLabel>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PATHS.map((p) => <PathCard key={p.title} {...p} />)}
          </div>
        </section>

        {/* 2) Interview prep + Resume lab ----------------------------- */}
        <section className="grid lg:grid-cols-2 gap-4" id="interview-prep">
          <Card data-testid="career-interview-prep">
            <CardHeader icon={ClipboardCheck} title="Interview prep by level"
              action={<Link to="/community" className="text-[12px] font-medium" style={{ color: C.green }}>See all →</Link>} />
            <ul>
              {LEVELS.map((lv, i) => (
                <li
                  key={lv.label}
                  className="flex items-center gap-3 px-5 py-3"
                  style={i < LEVELS.length - 1 ? { borderBottom: `1px solid ${C.borderSoft}` } : {}}
                >
                  <span
                    className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded shrink-0"
                    style={{ background: lv.bg, color: lv.color, minWidth: 84, justifyContent: "center" }}
                  >
                    {lv.label}
                  </span>
                  <span className="flex-1 text-[13px]" style={{ color: C.textDim }}>{lv.desc}</span>
                  <span className="text-[12px] font-medium shrink-0" style={{ color: C.textMuted }}>{lv.qs} Qs</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card data-testid="career-resume-lab">
            <CardHeader icon={FileText} title="Resume & profile lab"
              action={<Link to="/community" className="text-[12px] font-medium" style={{ color: C.green }}>See all →</Link>} />
            <ul className="px-5 py-2">
              {RESUME_CHECKS.map((item, i) => (
                <li
                  key={item}
                  className="flex items-start gap-3 py-3"
                  style={i < RESUME_CHECKS.length - 1 ? { borderBottom: `1px solid ${C.borderSoft}` } : {}}
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.green }} />
                  <span className="text-[13px]" style={{ color: C.textDim }}>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* 3) HIRING LEADER TOOLKIT ------------------------------------ */}
        <section id="hiring">
          <Card data-testid="career-hiring-toolkit">
            <CardHeader icon={Users} title="Hiring leader toolkit"
              action={<Link to="/community" className="text-[12px] font-medium" style={{ color: C.green }}>See all →</Link>} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              {HIRING_TOOLS.map(({ Icon, label }, i) => (
                <div
                  key={label}
                  className="p-5 flex flex-col gap-3"
                  style={{
                    borderRight: i < HIRING_TOOLS.length - 1 ? `1px solid ${C.borderSoft}` : "none",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ background: "rgba(29,181,137,0.10)", color: C.green }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-[13px] font-medium" style={{ color: C.text }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* 4) WORKDAY ECOSYSTEM EXPLORER ------------------------------ */}
        <section>
          <Card data-testid="career-ecosystem-explorer">
            <div className="p-5">
              <SectionLabel>Workday ecosystem explorer</SectionLabel>
              <p className="text-[13px] mb-4" style={{ color: C.textDim }}>
                Customers, partners, firms, and employers actively using Workday
              </p>
              <div className="flex flex-wrap gap-2">
                {ECOSYSTEM_PILLS.map((p) => (
                  <span
                    key={p.label}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium"
                    style={{ background: "#F1F5F9", color: C.text }}
                  >
                    {p.label}
                    {p.count && <span className="font-semibold" style={{ color: C.green }}>{p.count}</span>}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* BOTTOM CTA BAND -------------------------------------------- */}
        <section
          className="rounded-xl p-8 lg:p-10 text-white flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10"
          style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyEnd} 100%)` }}
          data-testid="career-bottom-cta"
        >
          <div className="flex-1">
            <h3 className="font-bold text-[22px] lg:text-[24px] tracking-tight mb-2">
              Looking for a Workday role, or hiring Workday talent?
            </h3>
            <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              Connect with practitioners, hiring leaders, recruiters, and firms across the ecosystem.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/community"
              className="inline-flex items-center px-5 py-3 rounded-md text-[14px] font-semibold"
              style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.55)" }}
              data-testid="cta-join-discussions"
            >
              Join career discussions
            </Link>
            <Link
              to="/connect"
              className="inline-flex items-center px-5 py-3 rounded-md text-[14px] font-semibold"
              style={{ background: C.green, color: "white" }}
              data-testid="cta-share-hiring-need"
            >
              Share a hiring need
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

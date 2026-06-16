import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Building2,
  ShieldCheck,
  Workflow,
  Layers,
  Users,
  FileText,
  MessageSquare,
  Library,
  BookOpen,
  Quote,
} from "lucide-react";
import NavHeader from "../components/NavHeader";

const KNOWLEDGE_SOURCES = [
  { icon: Users, title: "Consultant knowledge", desc: "Locked inside a few senior heads — and gone the day they leave the project." },
  { icon: FileText, title: "Project documents", desc: "Buried in SharePoints, Confluence, and Drives nobody can search across." },
  { icon: MessageSquare, title: "Tribal team knowledge", desc: "Lives in Slack DMs and stand-up tangents. Useful for two weeks, then lost." },
  { icon: Library, title: "Workday Community", desc: "Excellent for product docs and release notes — but not for candid practitioner conversations." },
  { icon: Layers, title: "Slack / Teams discussions", desc: "Decisions made today are unsearchable next quarter. No one inherits the context." },
];

const DIFFERENTIATORS = [
  {
    icon: Building2,
    label: "Architecture",
    desc: "How real practitioners structure tenants, data models, business processes, and release strategies — the trade-offs vendor docs won't tell you.",
  },
  {
    icon: Workflow,
    label: "Governance",
    desc: "Change control, sandbox refresh cadence, role ownership, and audit trails — the operating discipline that separates healthy tenants from chaos.",
  },
  {
    icon: ShieldCheck,
    label: "Security",
    desc: "Domain and business process security policies, segregation of duties, role design for multi-entity orgs — patterns proven in production.",
  },
  {
    icon: Layers,
    label: "Integrations",
    desc: "EIBs, Studio, Cloud Connect, RaaS — what fails silently, what scales, and what holds up when the vendor pushes a release.",
  },
];

const VISION_POINTS = [
  { title: "Learn", desc: "From real implementations across industries, not curated case studies." },
  { title: "Solve", desc: "Production problems with answers from people who've already lived them." },
  { title: "Grow", desc: "Careers — together with a network of practitioners who get what you do." },
];

export default function WhyHCMOrbit() {
  return (
    <div className="min-h-screen bg-white" data-testid="why-hcmorbit-page">
      <NavHeader />

      {/* Hero */}
      <section className="relative bg-[#0A1628] text-white overflow-hidden" data-testid="why-hero">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-[#0D9373]/15 blur-[120px] pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-8 py-24 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9373]" />
              About HCMOrbit
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Why <span className="text-[#0D9373]">HCMOrbit</span> Exists
            </h1>
            <h2 className="mt-6 text-xl lg:text-2xl font-medium text-white">
              Most Workday professionals learn the hard way.
            </h2>
            <div className="mt-6 space-y-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed">
              <p>A report breaks the night before an executive review. A security policy change quietly exposes data nobody noticed for a week. An integration that worked yesterday fails after a config update — and the audit log offers no answer.</p>
              <p>Every Workday practitioner has been here. We learn by getting burned, then we patch the next person in privately, one DM at a time.</p>
              <p className="text-white font-medium">HCMOrbit was created to change that.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 lg:py-24 bg-white" data-testid="why-problem">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">The Problem</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">The knowledge exists — it&apos;s just fragmented.</h2>
            <p className="text-[#64748B] mt-4 leading-relaxed">
              Workday expertise is everywhere. Inside consultants&apos; heads. Inside project decks. Inside Slack threads from two implementations ago. The problem isn&apos;t that the answers don&apos;t exist — it&apos;s that nobody can find them when they actually need them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="why-problem-grid">
            {KNOWLEDGE_SOURCES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6">
                <div className="w-10 h-10 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-heading font-semibold text-[#0A1628]">{title}</div>
                <div className="mt-2 text-sm text-[#475569] leading-relaxed">{desc}</div>
              </div>
            ))}
            <Link
              to="/knowledge-base"
              data-testid="why-problem-kb-card"
              className="group bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 hover:border-[#0D9373] hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="w-10 h-10 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center mb-4 group-hover:bg-[#0D9373] group-hover:text-white transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="font-heading font-semibold text-[#0A1628] group-hover:text-[#0D9373] transition-colors flex items-center gap-1.5">
                HCMOrbit Knowledge Base
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-[#0D9373] font-semibold">Structured practitioner knowledge</div>
              <div className="mt-3 text-sm text-[#475569] leading-relaxed">
                Turn lessons learned, implementation patterns, governance frameworks, and troubleshooting guides into searchable knowledge that remains available long after projects end.
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Why HCMOrbit Was Created */}
      <section className="relative bg-[#0A1628] text-white py-20 lg:py-28 overflow-hidden" data-testid="why-created">
        <div className="absolute -left-32 top-1/3 w-[480px] h-[480px] rounded-full bg-[#0D9373]/12 blur-[120px] pointer-events-none" />
        <div className="relative max-w-[1000px] mx-auto px-6 lg:px-8 text-center">
          <div className="inline-block text-xs uppercase tracking-[0.18em] text-[#0D9373] font-semibold mb-3">Why HCMOrbit Was Created</div>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight">A practitioner-first community.</h2>
          <p className="mt-6 text-lg text-white/65 max-w-2xl mx-auto leading-relaxed">
            Not another blog. Not another marketing site. A place built by Workday practitioners, for Workday practitioners.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto text-left">
            {[
              "Learn from real implementations.",
              "Solve real Workday problems.",
              "Share practical experience.",
              "Build expertise together.",
            ].map((p) => (
              <div key={p} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-lg px-5 py-4">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0D9373]" />
                <span className="text-[15px]">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 lg:py-24 bg-white" data-testid="why-different">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">What Makes Us Different</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Depth in the four pillars Workday teams actually live in.</h2>
            <p className="text-[#64748B] mt-4 leading-relaxed">
              Most communities are an inch deep across a hundred topics. HCMOrbit goes a mile deep across the four that determine whether your tenant ships, scales, and stays compliant.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4" data-testid="why-different-grid">
            {DIFFERENTIATORS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white border border-[#E2E8F0] rounded-xl p-6 hover:border-[#0D9373]/40 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-heading font-semibold text-[#0A1628] text-lg">{label}</div>
                </div>
                <p className="text-sm text-[#475569] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder story */}
      <section id="founder" className="bg-[#F8FAFC] py-20 lg:py-24 scroll-mt-24" data-testid="why-founder">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight text-[#0A1628] mb-12">
            Meet the Founder
          </h2>
          <div className="grid lg:grid-cols-[340px_1fr] gap-10 lg:gap-14 items-start">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <img
                src="/suchi_founder_photo.png"
                alt="Suchismita (Suchi) Tripathy"
                className="w-72 h-72 object-contain"
                data-testid="why-founder-photo"
              />
              <div className="mt-5 font-heading text-xl font-bold text-[#0A1628]">Suchismita (Suchi) Tripathy</div>
              <div className="mt-1 text-sm font-medium text-[#0D9373]">Founder, HCMOrbit</div>
              <Quote className="w-6 h-6 text-[#0D9373]/40 mt-6 hidden lg:block" />
            </div>

            <div className="space-y-5 text-[15px] lg:text-base leading-relaxed text-[#334155]" data-testid="founder-story">
              <p>Hi, I&apos;m Suchismita — most people call me <strong className="text-[#0A1628] font-semibold">Suchi</strong>!</p>
              <p>I&apos;ve spent <strong className="text-[#0A1628] font-semibold">17+ years working across the full spectrum of HR technology</strong> — <strong className="text-[#0A1628] font-semibold">HRIS, ERP, Workday, SAP, UKG, SuccessFactors</strong>, Dayforce, Oracle HCM, and ADP — supporting enterprise organizations across <strong className="text-[#0A1628] font-semibold">Healthcare, Manufacturing, Technology, and Services</strong>.</p>
              <p>Since 2022 I&apos;ve been <strong className="text-[#0A1628] font-semibold">focused on Workday, serving as Technical Lead and Architect</strong> — most recently designing and building the entire HRIS system from the ground up for an EV startup.</p>
              <p>Across every platform, every employer, every implementation — <strong className="text-[#0A1628] font-semibold">I kept seeing the same problems repeated</strong>. The same retro pay headache. The same integration that fails after the release. The same security model that nobody documented before the architect left.</p>
              <p>I kept running into the same problem throughout my career. <strong className="text-[#0A1628] font-semibold">There was no dedicated space where HR technology practitioners could openly share real challenges</strong>, learn from each other&apos;s implementations, and grow together professionally.</p>
              <p>LinkedIn is too noisy. Generic HR forums don&apos;t go deep enough. Workday Community is great for product docs — <strong className="text-[#0A1628] font-semibold">but not for candid practitioner conversations</strong>.</p>
              <p><strong className="text-[#0A1628] font-semibold">HCMOrbit was built to fill that gap</strong> — a focused community where Workday professionals can ask hard questions without judgment, share what actually works in production, and build meaningful careers together.</p>
              <p>Whether you&apos;re new to Workday or a seasoned architect — <strong className="text-[#0A1628] font-semibold">this community was built by a practitioner, for practitioners</strong>.</p>
              <p className="text-[#0A1628] font-semibold pt-2">— Suchi, Founder of HCMOrbit</p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Vision */}
      <section className="py-20 lg:py-24 bg-white" data-testid="why-vision">
        <div className="max-w-[1000px] mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Our Vision</div>
            <h2 className="font-heading text-3xl lg:text-5xl font-semibold text-[#0A1628] tracking-tight">
              The most trusted independent knowledge platform for Workday professionals.
            </h2>
            <p className="text-[#64748B] mt-5 leading-relaxed max-w-2xl mx-auto">
              Independent. Practitioner-led. Signal over noise. A place where the answers you find were earned, not marketed.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4" data-testid="why-vision-grid">
            {VISION_POINTS.map((v) => (
              <div key={v.title} className="bg-white border border-[#E2E8F0] rounded-xl p-6">
                <CheckCircle2 className="w-6 h-6 text-[#0D9373]" />
                <div className="font-heading text-2xl font-bold text-[#0A1628] mt-4">{v.title}.</div>
                <p className="mt-2 text-sm text-[#475569] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-[#0A1628] text-white py-20 lg:py-28 overflow-hidden" data-testid="why-cta">
        <div className="absolute right-0 top-0 w-[520px] h-[520px] rounded-full bg-[#0D9373]/12 blur-[120px] pointer-events-none" />
        <div className="relative max-w-[900px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">Ready to join?</h2>
          <p className="mt-5 text-lg text-white/70">Built by practitioners. For practitioners.</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              data-testid="why-cta-join"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-semibold transition-colors"
            >
              Join Community <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/knowledge-base"
              data-testid="why-cta-kb"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md border border-white/30 hover:border-[#0D9373] hover:bg-white/5 text-white font-semibold transition-colors"
            >
              Browse Knowledge Base
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

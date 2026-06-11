import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CheckCircle2, MessageSquare, Users, Network, Shield, BarChart3, CircleDollarSign, Wallet, Landmark, Coffee, Sparkles } from "lucide-react";
import NavHeader from "../components/NavHeader";
import GroupBadge from "../components/GroupBadge";
import PostTypeBadge from "../components/PostTypeBadge";
import { api, timeAgo } from "../lib/api";

const ICON_MAP = { Users, Network, Shield, BarChart3, CircleDollarSign, Wallet, Landmark, Coffee };

const QUOTES = [
  { group: "aspirant", text: "I went from 'what is a business process?' to launching my first integration in 4 months. The community answered every dumb question I had.", name: "Marcus T.", role: "Workday Aspirant · Austin" },
  { group: "practitioner", text: "It's the only place I trust for honest architecture debates. Stack Overflow doesn't get Workday. LinkedIn is noise. This is signal.", name: "Elena C.", role: "Integration Architect · Seattle" },
  { group: "employer", text: "We've hired 3 senior consultants directly from candidates we noticed answering questions here. Reputation tells me what a resume can't.", name: "Mira H.", role: "Talent Lead · Northbridge HR Tech" },
];

const GROUP_CARDS = [
  {
    id: "aspirant", title: "Aspirants & Learners", color: "#0D9373",
    bullets: ["Breaking into Workday (0–3 yrs)", "Career changers & recent grads", "Self-taught practitioners building toward certification"],
    promise: "Ask any question without judgment. Get answers from people who were where you are 2 years ago.",
  },
  {
    id: "practitioner", title: "Practitioners & Freelancers", color: "#1D6FE8",
    bullets: ["Certified consultants, devs, architects (3–10+ yrs)", "Full-time, freelance, or open to opportunities", "People who've shipped real Workday work"],
    promise: "Peer technical debate. Release deep-dives. Visibility to teams that hire at the senior end.",
  },
  {
    id: "employer", title: "Employers & Firms", color: "#C47B0A",
    bullets: ["In-house Workday teams hiring talent", "Boutique consulting firms staffing engagements", "HR & IT leaders evaluating partners"],
    promise: "Spot trust signals. Answer aspirant questions to build brand. Find practitioners by what they actually know.",
  },
];

const ROLES = [
  "Workday HCM Analysts",
  "Workday Architects",
  "Workday Reporting Analysts",
  "Workday Functional Leads",
  "Workday Integration Specialists",
  "Workday Security Administrators",
  "Workday Payroll Specialists",
  "Workday Project Managers",
];

const REASONS = [
  "Solve Workday production issues faster",
  "Learn from real Workday implementations",
  "Accelerate your Workday career",
  "Share integration and EIB solutions",
  "Stay ahead of Workday releases and AI features",
  "Build your Workday professional network",
];

function Counter({ value, suffix = "" }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof value !== "number") return;
    let raf;
    const start = performance.now();
    const dur = 1200;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.floor(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="counter">{n.toLocaleString()}{suffix}</span>;
}

export default function Landing() {
  const [stats, setStats] = useState({});
  const [spaces, setSpaces] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/community/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/spaces").then(r => setSpaces(r.data)).catch(() => {});
    api.get("/community/recent-activity?limit=5").then(r => setRecent(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      <NavHeader />

      {/* Hero */}
      <section className="relative bg-[#0A1628] text-white overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-[#0D9373]/15 blur-[120px] pointer-events-none" />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9373]" />
              Independent community for the Workday ecosystem
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              The Community Where Workday Professionals <span className="text-[#0D9373]">Learn, Solve,</span> and Grow
            </h1>
            <p className="mt-6 text-lg lg:text-xl text-white/70 max-w-2xl leading-relaxed">
              Join Workday HCM, Payroll, Integrations, Reporting, and Security professionals solving real-world challenges, sharing best practices, and building their careers together.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium transition-colors" data-testid="hero-cta-join">
                Join the Community <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register?founder=1" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-white/30 hover:border-[#0D9373] hover:bg-white/5 text-white font-medium transition-colors" data-testid="hero-cta-founder">
                Become a Founding Member
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/50 max-w-2xl leading-relaxed" data-testid="hero-trust">
              Built by a Workday practitioner with 17+ years of enterprise HCM experience across implementations, integrations, and support.
            </p>
          </div>
        </div>
      </section>

      {/* Built For Workday Professionals */}
      <section className="py-20 lg:py-24 bg-white" data-testid="built-for-section">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Built For</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Built for Workday professionals.</h2>
            <p className="text-[#64748B] mt-3">If your day-to-day touches Workday, this is your community.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4" data-testid="built-for-grid">
            {ROLES.map((role) => (
              <div key={role} className="flex items-center gap-3 text-[15px] text-[#0F172A]">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0D9373]" />
                <span>{role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Workday Professionals Join */}
      <section className="py-20 lg:py-24 bg-[#F8FAFC]" data-testid="why-join-section">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Why Members Join</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Why Workday professionals join.</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4" data-testid="why-join-grid">
            {REASONS.map((r) => (
              <div key={r} className="flex items-start gap-3 bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373]/40 transition-colors">
                <span className="text-2xl leading-none shrink-0" aria-hidden>🚀</span>
                <span className="text-[15px] text-[#0F172A] leading-relaxed">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Groups */}
      <section className="py-20 lg:py-28 bg-[#F8FAFC]" data-testid="groups-section">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Three groups, one community</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Find your people. They&apos;ve been in your seat.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {GROUP_CARDS.map((g) => (
              <div key={g.id} className="bg-white border border-[#E2E8F0] rounded-xl p-7 hover:border-[#94A3B8] transition-colors" data-testid={`group-card-${g.id}`}>
                <GroupBadge group={g.id} size="lg" />
                <h3 className="font-heading text-xl font-semibold text-[#0A1628] mt-4">{g.title}</h3>
                <ul className="mt-4 space-y-2">
                  {g.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#475569]">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: g.color }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-5 border-t border-[#E2E8F0] text-sm text-[#0F172A] leading-relaxed">{g.promise}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="py-14 bg-[#0A1628] text-white" data-testid="stats-section">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="font-heading text-4xl lg:text-5xl font-bold text-white"><Counter value={stats.members || 0} /></div>
            <div className="text-sm text-white/60 mt-2 uppercase tracking-wider">Members</div>
          </div>
          <div>
            <div className="font-heading text-4xl lg:text-5xl font-bold text-white"><Counter value={stats.posts || 0} /></div>
            <div className="text-sm text-white/60 mt-2 uppercase tracking-wider">Posts</div>
          </div>
          <div>
            <div className="font-heading text-4xl lg:text-5xl font-bold text-white"><Counter value={stats.answers || 0} /></div>
            <div className="text-sm text-white/60 mt-2 uppercase tracking-wider">Answers</div>
          </div>
          <div>
            <div className="font-heading text-4xl lg:text-5xl font-bold text-[#0D9373]"><Counter value={stats.active_today || 0} /></div>
            <div className="text-sm text-white/60 mt-2 uppercase tracking-wider">Active today</div>
          </div>
        </div>
      </section>

      {/* Featured Spaces */}
      <section className="py-20 lg:py-24 bg-white" data-testid="spaces-section">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Spaces</div>
              <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Topic spaces. Real expertise.</h2>
              <p className="text-[#64748B] mt-3">Eight module-based spaces where Workday practitioners go deep on what they actually work on.</p>
            </div>
            <Link to="/community" className="hidden sm:inline-flex items-center gap-1 text-sm text-[#0D9373] hover:underline font-medium">
              Browse all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {spaces.map((s) => {
              const Icon = ICON_MAP[s.icon] || Users;
              return (
                <Link key={s.slug} to={`/community/spaces/${s.slug}`} className="group bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373] hover:bg-white transition-all" data-testid={`featured-space-${s.slug}`}>
                  <div className="w-10 h-10 rounded-md bg-[#0A1628] flex items-center justify-center mb-4 group-hover:bg-[#0D9373] transition-colors">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-heading font-semibold text-[#0A1628]">{s.name}</div>
                  <div className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-relaxed">{s.description}</div>
                  <div className="text-xs text-[#94A3B8] mt-3 counter">{s.post_count} posts</div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="py-20 lg:py-24 bg-[#F8FAFC]" data-testid="recent-section">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="mb-10">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Live from the community</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628]">Recent posts</h2>
          </div>
          <div className="space-y-3">
            {recent.map((p) => (
              <Link key={p.id} to={`/community/posts/${p.id}`} className="block bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373]/40 hover:shadow-sm transition-all" data-testid={`recent-post-${p.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  <PostTypeBadge type={p.type} />
                  <span className="text-xs text-[#0D9373] font-medium">{p.space?.name}</span>
                  {p.is_solved && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#16A34A] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-semibold text-[#0A1628] leading-snug">{p.title}</h3>
                <div className="flex items-center gap-3 mt-3 text-xs text-[#64748B]">
                  <span className="font-medium text-[#0F172A]">{p.author?.full_name}</span>
                  <GroupBadge group={p.author?.group_type} />
                  <span>{timeAgo(p.created_at)}</span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {p.answer_count}</span>
                    <span className="counter">{p.vote_count} votes</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 lg:py-24 bg-white" data-testid="quotes-section">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">From the community</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-semibold text-[#0A1628] max-w-2xl">What members say.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {QUOTES.map((q, i) => (
              <figure key={i} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-7" data-testid={`quote-${q.group}`}>
                <GroupBadge group={q.group} />
                <blockquote className="mt-4 text-[#0F172A] leading-relaxed">&ldquo;{q.text}&rdquo;</blockquote>
                <figcaption className="mt-5 pt-5 border-t border-[#E2E8F0]">
                  <div className="font-medium text-sm text-[#0F172A]">{q.name}</div>
                  <div className="text-xs text-[#64748B] mt-0.5">{q.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-24 bg-[#0A1628] text-white" data-testid="cta-section">
        <div className="max-w-[900px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight">Ready to join?</h2>
          <p className="mt-5 text-lg text-white/70 max-w-2xl mx-auto">
            Independent. Free. Built for serious Workday professionals. No recruiters in your DMs, no AI-spam posts.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium" data-testid="cta-register">
              Create your account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/community" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-medium">
              Browse posts first
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#0A1628] border-t border-white/10 py-8 text-center text-xs text-white/40">
        © 2026 HCMOrbit · Independent community for the HCM ecosystem
      </footer>
    </div>
  );
}

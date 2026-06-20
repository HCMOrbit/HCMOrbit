import React from "react";
import { Link } from "react-router-dom";
import { Briefcase, ArrowRight, Sparkles } from "lucide-react";
import NavHeader from "../components/NavHeader";

export default function CareerHub() {
  return (
    <div className="min-h-screen bg-white" data-testid="career-hub-page">
      <NavHeader />
      <main className="max-w-[1100px] mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D9373]/10 text-[#0D9373] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Coming soon
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0A1628] tracking-tight">
            Career Hub
          </h1>
          <p className="text-lg text-[#475569] max-w-2xl leading-relaxed">
            The dedicated space for Workday professionals to grow their careers — curated job postings,
            referrals from practitioners, salary insights, and interview prep led by the HCMOrbit community.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 w-full max-w-3xl mt-4">
            {[
              { title: "Curated Workday roles", body: "Hand-picked HCM, Integrations, Reporting & Studio jobs from trusted partners." },
              { title: "Referral network", body: "Practitioners referring practitioners. Stop applying into the void." },
              { title: "Salary benchmarks", body: "Anonymous, peer-reported compensation data by module & region." },
              { title: "Interview prep", body: "Live mocks, scenario libraries, and module-specific question banks." },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-[#0A1628] text-white flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-[#0A1628]">{c.title}</h3>
                </div>
                <p className="text-sm text-[#64748B] leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/community" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold transition-colors" data-testid="career-cta-community">
              Join the community <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/ecosystem" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#E2E8F0] hover:border-[#0D9373] hover:text-[#0D9373] text-sm font-semibold text-[#0A1628] transition-colors" data-testid="career-cta-ecosystem">
              Explore the ecosystem
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

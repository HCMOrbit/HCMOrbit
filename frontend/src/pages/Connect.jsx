import React from "react";
import { Link } from "react-router-dom";
import { Mail, MessageSquare, Linkedin, ArrowRight, Sparkles } from "lucide-react";
import NavHeader from "../components/NavHeader";

export default function Connect() {
  return (
    <div className="min-h-screen bg-white" data-testid="connect-page">
      <NavHeader />
      <main className="max-w-[1100px] mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0D9373]/10 text-[#0D9373] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> We&apos;d love to hear from you
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0A1628] tracking-tight">
            Connect
          </h1>
          <p className="text-lg text-[#475569] max-w-2xl leading-relaxed">
            Partnerships, press, speaking opportunities, or just a hello — pick a channel that works for you.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 w-full max-w-3xl mt-4">
            <a href="mailto:hello@hcmorbit.com" className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 hover:border-[#0D9373] transition-colors" data-testid="connect-email">
              <div className="w-10 h-10 rounded-md bg-[#0A1628] text-white flex items-center justify-center mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#0A1628]">Email</h3>
              <p className="text-sm text-[#64748B] mt-1">hello@hcmorbit.com</p>
            </a>
            <Link to="/community" className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 hover:border-[#0D9373] transition-colors" data-testid="connect-community">
              <div className="w-10 h-10 rounded-md bg-[#0A1628] text-white flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#0A1628]">Community</h3>
              <p className="text-sm text-[#64748B] mt-1">Ask in the open forum.</p>
            </Link>
            <a href="https://www.linkedin.com/company/hcmorbit" target="_blank" rel="noreferrer" className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 hover:border-[#0D9373] transition-colors" data-testid="connect-linkedin">
              <div className="w-10 h-10 rounded-md bg-[#0A1628] text-white flex items-center justify-center mb-3">
                <Linkedin className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[#0A1628]">LinkedIn</h3>
              <p className="text-sm text-[#64748B] mt-1">Follow & DM the team.</p>
            </a>
          </div>

          <div className="mt-8">
            <Link to="/why-hcmorbit" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold transition-colors" data-testid="connect-cta-why">
              Why HCMOrbit exists <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

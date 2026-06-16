import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import NavHeader from "./NavHeader";

export default function LegalLayout({ title, updated, intro, children }) {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <NavHeader />
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-6 py-14">
          <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold">Legal</div>
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-[#0A1628] mt-2">{title}</h1>
          <div className="text-xs text-[#64748B] mt-2">Last updated: {updated}</div>
          {intro && <p className="mt-6 text-[15px] text-[#64748B] leading-[1.8]">{intro}</p>}
          <div className="legal-body mt-8">{children}</div>
        </div>
      </main>
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#0A1628] text-white shadow-lg hover:bg-[#0F1F36] flex items-center justify-center"
          aria-label="Back to top" data-testid="back-to-top">
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
      <style>{`
        .legal-body h2 { font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 500; color: #0F172A; margin-top: 32px; margin-bottom: 12px; }
        .legal-body p { font-size: 14px; line-height: 1.8; color: #475569; margin-bottom: 12px; }
        .legal-body ul { margin: 8px 0 16px 22px; list-style: disc; font-size: 14px; line-height: 1.8; color: #475569; }
        .legal-body li { margin-bottom: 4px; }
        .legal-body a { color: #0D9373; text-decoration: none; }
        .legal-body a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import NavHeader from "./NavHeader";
import PageHero from "./PageHero";

export default function LegalLayout({ title, updated, intro, children }) {
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <NavHeader />
      <PageHero
        eyebrow="Legal"
        title={title}
        description={intro}
        maxWidth="900px"
        testId="legal-hero"
      >
        <div className="mt-4 text-xs text-white/50">Last updated: {updated}</div>
      </PageHero>
      <main>
        <div className="max-w-[900px] mx-auto px-6 lg:px-8 py-10">
          <div className="legal-body">{children}</div>
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

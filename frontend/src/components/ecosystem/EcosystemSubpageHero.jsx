import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Dark-navy hero header with breadcrumb for Ecosystem sub-pages.
 * Mirrors the visual language of the main /ecosystem hub.
 */
export default function EcosystemSubpageHero({ eyebrow, title, description, current }) {
  return (
    <section className="bg-[#0A1628] text-white" data-testid="ecosystem-subpage-hero">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 lg:py-14">
        <nav
          className="text-xs flex items-center gap-1.5 mb-5 text-white/70"
          data-testid="ecosystem-subpage-breadcrumb"
        >
          <Link to="/" className="hover:text-white">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/ecosystem" className="text-[#0D9373] hover:underline">Ecosystem</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">{current}</span>
        </nav>
        {eyebrow && (
          <div className="text-xs uppercase tracking-[0.18em] text-[#0D9373] font-bold mb-3">
            {eyebrow}
          </div>
        )}
        <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}

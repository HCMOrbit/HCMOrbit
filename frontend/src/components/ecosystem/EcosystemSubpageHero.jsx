import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Ecosystem sub-page hero. Visual language matches the Knowledge Base hero
 * (`KBHome.jsx` → `KBHero`): rounded card with a 135° navy gradient, amber
 * eyebrow, white `font-heading` title. Breadcrumb sits above the eyebrow
 * because these pages are nested under `/ecosystem/…`.
 */
export default function EcosystemSubpageHero({ eyebrow, title, description, current }) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-8">
      <section
        data-testid="ecosystem-subpage-hero"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
          borderRadius: 18,
          padding: "38px 32px",
          color: "#ffffff",
        }}
      >
        <nav
          className="text-xs flex items-center gap-1.5 mb-5 text-white/70"
          data-testid="ecosystem-subpage-breadcrumb"
        >
          <Link to="/" className="hover:text-white">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/ecosystem" className="hover:text-white" style={{ color: "#F5B731" }}>
            Ecosystem
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">{current}</span>
        </nav>
        {eyebrow && (
          <div
            data-testid="ecosystem-subpage-eyebrow"
            style={{
              color: "#F5B731",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="font-heading"
          style={{
            color: "#ffffff",
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            marginBottom: description ? 16 : 0,
          }}
          data-testid="ecosystem-subpage-title"
        >
          {title}
        </h1>
        {description && (
          <p className="text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </section>
    </div>
  );
}

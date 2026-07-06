import React from "react";

/**
 * Standardized page hero used across the entire site.
 *
 * Locked visual language — mirrors the Knowledge Base home hero (`KBHome`) so
 * every top-level page shares one identity:
 *   – 135° navy gradient card (#0a1628 → #0d2d3a), 18px border-radius, 38×32 pad
 *   – amber eyebrow (#F5B731) — uppercase, 15px, letter-spacing 0.14em
 *   – white `font-heading` h1, 44px, weight 700
 *   – description in white/70, max 2xl width
 *   – card sits inside a max-w-[1200px] container with pt-8, giving it the
 *     signature "floating rounded panel" feel on any page background.
 *
 * Slots:
 *   – `breadcrumb`  — rendered above the eyebrow (e.g. Home › Ecosystem › X)
 *   – `children`    — rendered below the description (badges, CTAs, search)
 */
export default function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  children,
  className = "",
  containerClassName = "",
  maxWidth = "1200px",
  testId = "page-hero",
}) {
  return (
    <div
      className={`mx-auto px-6 lg:px-8 pt-8 ${containerClassName}`}
      style={{ maxWidth }}
    >
      <section
        data-testid={testId}
        className={`relative overflow-hidden ${className}`}
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
          borderRadius: 18,
          padding: "38px 32px",
          color: "#ffffff",
        }}
      >
        {breadcrumb}
        {eyebrow && (
          <div
            data-testid={`${testId}-eyebrow`}
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
          data-testid={`${testId}-title`}
        >
          {title}
        </h1>
        {description && (
          <p
            className="text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed"
            data-testid={`${testId}-description`}
          >
            {description}
          </p>
        )}
        {children}
      </section>
    </div>
  );
}

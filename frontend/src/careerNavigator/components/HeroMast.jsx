import React from "react";

/**
 * HeroMast — dark navy masthead used at the top of the Career Navigator.
 *
 * Props:
 *  - eyebrow:   small uppercase teal label
 *  - title:     main heading
 *  - subtitle:  secondary descriptive line
 *  - rightPill: optional ReactNode rendered top-right (e.g. a status pill)
 *  - children:  optional in-mast content rendered below the subtitle
 */
export default function HeroMast({ eyebrow, title, subtitle, rightPill, children }) {
  return (
    <section
      data-testid="career-navigator-heromast"
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
        borderRadius: 18,
        padding: "26px 28px",
        color: "#ffffff",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div
              style={{
                color: "#F5B731",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {eyebrow}
            </div>
          )}
          {title && (
            <h1 className="font-heading font-bold tracking-tight leading-[1.12] text-2xl sm:text-[28px]">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-sm sm:text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {rightPill && <div className="shrink-0">{rightPill}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

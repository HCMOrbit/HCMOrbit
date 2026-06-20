import React from "react";

/**
 * Standardized dark navy hero header used across all top-level pages.
 *
 * Visual spec (locked, matches /ecosystem hero):
 *  - background:   bg-[#0A1628] text-white
 *  - container:    max-w-[1200px] mx-auto px-6 lg:px-8 py-12 lg:py-14
 *  - eyebrow:      text-xs uppercase tracking-[0.18em] text-[#0D9373] font-bold mb-3
 *  - h1:           font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]
 *  - description:  mt-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed
 *
 * Pass `breadcrumb` as a ReactNode (rendered before the eyebrow) and `children`
 * for additional in-hero content (stats, CTAs, search forms, etc.).
 */
export default function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  children,
  className = "",
  testId = "page-hero",
}) {
  return (
    <section className={`bg-[#0A1628] text-white ${className}`} data-testid={testId}>
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 lg:py-14">
        {breadcrumb}
        {eyebrow && (
          <div className="text-xs uppercase tracking-[0.18em] text-[#0D9373] font-bold mb-3" data-testid={`${testId}-eyebrow`}>
            {eyebrow}
          </div>
        )}
        <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]" data-testid={`${testId}-title`}>
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-base lg:text-lg text-white/70 max-w-2xl leading-relaxed" data-testid={`${testId}-description`}>
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

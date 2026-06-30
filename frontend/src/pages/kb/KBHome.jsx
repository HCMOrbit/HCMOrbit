import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, LayoutGrid, Search, ArrowRight } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge, TYPE_BORDER, CAT_BG } from "../../components/kb/KBBadges";
import { api } from "../../lib/api";

const VISIBLE_COUNT = 9;

// Resting-style helper (setProperty + 'important' beats global button theme)
const setSearchBtnRest = (el) => {
  if (!el) return;
  el.style.setProperty("background", "#F5B731", "important");
  el.style.setProperty("color", "#0a1628", "important");
  el.style.setProperty("border", "none", "important");
};

function KBHero({ totalDocs, areaCount, onSearch }) {
  const [q, setQ] = useState("");
  const searchBtnRef = useRef(null);
  useEffect(() => { setSearchBtnRest(searchBtnRef.current); }, []);

  const countLabel = totalDocs != null ? totalDocs : 937;
  const areas = areaCount || 17;

  const submit = (e) => {
    if (e) e.preventDefault();
    const term = q.trim();
    if (!term) return; // empty-query guard
    onSearch(term);
  };

  return (
    <section
      data-testid="kb-hero"
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
        borderRadius: 18,
        padding: "38px 24px",
        color: "#ffffff",
      }}
    >
      <div className="max-w-[760px] mx-auto text-center">
        <div
          data-testid="kb-hero-eyebrow"
          style={{
            color: "#F5B731",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          HCMOrbit Knowledge Base
        </div>
        <h1
          className="font-heading"
          style={{
            color: "#ffffff",
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            marginBottom: 24,
          }}
          data-testid="kb-hero-title"
        >
          Find the answer.
        </h1>

        <form
          onSubmit={submit}
          className="mx-auto flex items-center gap-2"
          style={{ maxWidth: 560 }}
          data-testid="kb-hero-search-form"
        >
          <div
            className="flex-1 flex items-center"
            style={{
              background: "#ffffff",
              borderRadius: 10,
              padding: "10px 14px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "#0d1b2a" }} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${countLabel} guides…`}
              data-testid="kb-hero-search-input"
              className="flex-1 ml-2 bg-transparent outline-none text-[14px]"
              style={{ color: "#0d1b2a" }}
            />
          </div>
          <button
            type="submit"
            ref={searchBtnRef}
            data-testid="kb-hero-search-button"
            className="text-[14px] px-5 py-[12px] rounded-md"
            style={{ fontWeight: 600 }}
          >
            Search
          </button>
        </form>

        <div
          className="mt-4 text-center"
          style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}
          data-testid="kb-hero-count-line"
        >
          <span style={{ color: "#F5B731", fontWeight: 600 }} data-testid="kb-hero-doc-count">
            {countLabel}
          </span>{" "}
          guides across{" "}
          <span style={{ color: "#F5B731", fontWeight: 600 }} data-testid="kb-hero-area-count">
            {areas}
          </span>{" "}
          functional areas — and growing
        </div>
      </div>
    </section>
  );
}

export default function KBHome() {
  const [kbStats, setKbStats] = useState({});
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/kb/stats").then((r) => setKbStats(r.data)).catch(() => {});
    api.get("/kb/featured?limit=3").then((r) => setFeatured(r.data)).catch(() => {});
    api.get("/kb/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const populated = categories
    .filter((c) => (c.doc_count || 0) > 0)
    .sort((a, b) => (b.doc_count || 0) - (a.doc_count || 0) || (a.sort_order || 99) - (b.sort_order || 99));
  const empty = categories
    .filter((c) => (c.doc_count || 0) === 0)
    .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
  const ordered = [...populated, ...empty];
  const first = ordered.slice(0, VISIBLE_COUNT);
  const rest = ordered.slice(VISIBLE_COUNT);
  const mostActiveSlug = populated[0]?.slug;

  // Global KB search — spans every functional area. No category anchoring.
  const runSearch = (term) => {
    navigate(`/knowledge-base/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-home">
      <NavHeader />
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 space-y-10">
        <KBHero totalDocs={kbStats.total_docs} areaCount={categories.length} onSearch={runSearch} />

        {/* Browse by functional area (full-width) */}
        <section data-testid="kb-browse-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-[#0D9373]" /> Browse by functional area
            </h2>
            {categories.length > 0 && (rest.length > 0 || showAll) && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                data-testid="kb-view-all-link"
                aria-expanded={showAll}
                className="inline-flex items-center gap-1 text-[14px] font-semibold transition-opacity hover:opacity-80"
                style={{ color: "#F5B731", background: "transparent", border: "none", cursor: "pointer" }}
              >
                {showAll ? "Show fewer" : `View all ${categories.length}`} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-categories">
            {first.map((c) => <CategoryBox key={c.slug} cat={c} isMostActive={c.slug === mostActiveSlug} />)}
            {showAll && rest.map((c) => <CategoryBox key={c.slug} cat={c} isMostActive={c.slug === mostActiveSlug} />)}
          </div>
        </section>

        {/* Featured (kept, full-width) */}
        <section data-testid="kb-featured-section">
          <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-[#0D9373]" /> Featured this week
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-featured">
            {featured.map((d) => (
              <Link
                key={d.id}
                to={`/knowledge-base/${d.category?.slug}/${d.id}`}
                className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-all border border-[#E2E8F0]"
                style={{ borderTopWidth: 3, borderTopColor: TYPE_BORDER(d.doc_type) }}
                data-testid={`featured-${d.id}`}
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <DocTypeBadge type={d.doc_type} />
                    <DifficultyBadge level={d.difficulty} />
                  </div>
                  <h3 className="font-heading font-semibold text-[#0A1628] line-clamp-3 leading-snug">{d.title}</h3>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B]">
                    <span className="counter">{d.view_count} views</span>
                    <span className="text-[#16A34A] font-medium">{d.helpful_pct}% helpful</span>
                    <span className="ml-auto text-[#0D9373] font-medium">{d.category?.name}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CategoryBox({ cat, isMostActive }) {
  const count = cat.doc_count || 0;
  const isEmpty = count === 0;
  return (
    <Link
      to={`/knowledge-base/${cat.slug}`}
      data-testid={`category-${cat.slug}`}
      className="group p-5 rounded-xl flex items-start gap-3.5 bg-white border border-[#CBD5E1] shadow-sm hover:shadow-md hover:border-[#0D9373] hover:-translate-y-0.5 transition-all"
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl ring-1 ring-black/5"
        style={{ background: isEmpty ? "#F1F5F9" : (CAT_BG[cat.slug] || "rgba(245,183,49,0.14)") }}
      >
        <span className={isEmpty ? "opacity-60" : ""}>{cat.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-[15px] leading-tight text-[#0A1628] group-hover:text-[#0D9373] transition-colors">
          {cat.name}
        </div>
        <div className={`text-[13px] mt-1.5 font-medium ${isEmpty ? "text-[#94A3B8]" : "text-[#475569]"}`}>
          {isEmpty ? "No docs yet" : <><span className="counter">{count}</span> doc{count === 1 ? "" : "s"}</>}
        </div>
        {isMostActive && (
          <span className="mt-2 inline-block px-2 py-0.5 rounded bg-[#0D9373]/12 text-[#0D9373] text-[10px] font-semibold uppercase tracking-wider">
            Most active
          </span>
        )}
      </div>
    </Link>
  );
}

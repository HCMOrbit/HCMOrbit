import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, LayoutGrid, PenSquare } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge, TYPE_BORDER, CAT_BG } from "../../components/kb/KBBadges";
import KBSidebar from "../../components/kb/KBSidebar";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const VISIBLE_COUNT = 9;

export default function KBHome() {
  const [stats, setStats] = useState({});
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const { user } = useAuth();
  const canContribute = !!user?.is_admin;

  useEffect(() => {
    api.get("/kb/stats").then((r) => setStats(r.data)).catch(() => {});
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

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-home">
      <NavHeader />
      <section className="bg-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[500px] rounded-full bg-[#0D9373]/10 blur-[120px]" />
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-8 py-16">
          <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">HCMOrbit Knowledge Base</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight">Find the answer. Share what you know.</h1>
          <p className="mt-4 text-lg text-white/70 max-w-2xl">Technical guides, fix documents, and learning resources — written by Workday practitioners, for Workday practitioners.</p>
          <div className="mt-8 flex flex-wrap items-end gap-10">
            <Stat value={stats.total_docs} label="Published documents" />
            <Stat value={stats.total_helpful_votes} label="Practitioners helped" />
            <Stat value={stats.avg_helpful_pct ? `${stats.avg_helpful_pct}%` : "—"} label="Avg helpful rating" />
            {canContribute && (
              <Link to="/knowledge-base/new" data-testid="kb-contribute-cta"
                    className="ml-auto inline-flex items-center gap-2 px-5 py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium transition-colors">
                <PenSquare className="w-4 h-4" /> Add a document
              </Link>
            )}
          </div>
        </div>
      </section>
      <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
        <KBSidebar activeSlug={null} activeSubModule={null} />
        <main className="flex-1 min-w-0">
          <section className="max-w-[960px] mx-auto px-6 lg:px-8 py-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#0D9373]" /> Featured this week
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-featured">
              {featured.map((d) => (
                <Link key={d.id} to={`/knowledge-base/${d.category?.slug}/${d.id}`}
                      className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-all border border-[#E2E8F0]"
                      style={{ borderTopWidth: 3, borderTopColor: TYPE_BORDER(d.doc_type) }}
                      data-testid={`featured-${d.id}`}>
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
          <section className="max-w-[960px] mx-auto px-6 lg:px-8 pb-20">
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2 mb-6">
              <LayoutGrid className="w-5 h-5 text-[#0D9373]" /> Browse by functional area
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-categories">
              {first.map((c) => <CategoryBox key={c.slug} cat={c} isMostActive={c.slug === mostActiveSlug} />)}
              {showAll && rest.map((c) => <CategoryBox key={c.slug} cat={c} isMostActive={c.slug === mostActiveSlug} />)}
            </div>
            {rest.length > 0 && (
              <div className="mt-8 flex justify-center">
                <button onClick={() => setShowAll((v) => !v)} data-testid="kb-view-all-toggle" aria-expanded={showAll}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-[#E2E8F0] bg-white hover:border-[#0D9373]/40 hover:text-[#0D9373] text-sm font-medium text-[#475569] transition-colors">
                  {showAll ? `Show fewer (${VISIBLE_COUNT} areas)` : `View all ${categories.length} areas`}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CategoryBox({ cat, isMostActive }) {
  const count = cat.doc_count || 0;
  const isEmpty = count === 0;

  return (
    <Link to={`/knowledge-base/${cat.slug}`} data-testid={`category-${cat.slug}`}
          className="group p-5 rounded-xl flex items-start gap-3.5 bg-white border border-[#CBD5E1] shadow-sm hover:shadow-md hover:border-[#0D9373] hover:-translate-y-0.5 transition-all">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl ring-1 ring-black/5"
           style={{ background: isEmpty ? "#F1F5F9" : (CAT_BG[cat.slug] || "#F1F5F9") }}>
        <span className={isEmpty ? "opacity-60" : ""}>{cat.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-[15px] leading-tight text-[#0A1628] group-hover:text-[#0D9373] transition-colors">{cat.name}</div>
        <div className={`text-[13px] mt-1.5 font-medium ${isEmpty ? "text-[#94A3B8]" : "text-[#475569]"}`}>
          {isEmpty ? "No docs yet" : <><span className="counter">{count}</span> doc{count === 1 ? "" : "s"}</>}
        </div>
        {isMostActive && (
          <span className="mt-2 inline-block px-2 py-0.5 rounded bg-[#0D9373]/12 text-[#0D9373] text-[10px] font-semibold uppercase tracking-wider">Most active</span>
        )}
      </div>
    </Link>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="font-heading text-4xl font-bold text-white counter">{value ?? "—"}</div>
      <div className="text-xs uppercase tracking-wider text-white/60 mt-1">{label}</div>
    </div>
  );
}

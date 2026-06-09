import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, LayoutGrid, ArrowRight, PenSquare } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge, CategoryIcon, TYPE_BORDER } from "../../components/kb/KBBadges";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function KBHome() {
  const [stats, setStats] = useState({});
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const { user } = useAuth();
  const canContribute = user && ["practitioner", "employer"].includes(user.group_type);

  useEffect(() => {
    api.get("/kb/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/kb/featured?limit=3").then((r) => setFeatured(r.data)).catch(() => {});
    api.get("/kb/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const mostActiveSlug = categories.reduce((max, c) => (c.doc_count > (max?.doc_count || 0) ? c : max), null)?.slug;

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-home">
      <NavHeader />
      <section className="bg-[#0A1628] text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[500px] rounded-full bg-[#0D9373]/10 blur-[120px]" />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-8 py-20">
          <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">HCMOrbit Knowledge Base</div>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">Find the answer. Share what you know.</h1>
          <p className="mt-5 text-lg text-white/70 max-w-2xl">Technical guides, fix documents, and learning resources — written by Workday practitioners, for Workday practitioners.</p>
          <div className="mt-10 flex flex-wrap items-end gap-12">
            <Stat value={stats.total_docs} label="Published documents" />
            <Stat value={stats.total_helpful_votes} label="Practitioners helped" />
            <Stat value={stats.avg_helpful_pct ? `${stats.avg_helpful_pct}%` : "—"} label="Avg helpful rating" />
            {canContribute && (
              <Link
                to="/knowledge-base/new"
                data-testid="kb-contribute-cta"
                className="ml-auto inline-flex items-center gap-2 px-5 py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium transition-colors"
              >
                <PenSquare className="w-4 h-4" /> Contribute a document
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0D9373]" /> Featured this week
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-featured">
          {featured.map((d) => (
            <Link key={d.id} to={`/knowledge-base/${d.category?.slug}/${d.id}`} className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-all border border-[#E2E8F0]" style={{ borderTopWidth: 3, borderTopColor: TYPE_BORDER(d.doc_type) }} data-testid={`featured-${d.id}`}>
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

      <section className="max-w-[1200px] mx-auto px-6 lg:px-8 pb-20">
        <h2 className="font-heading text-xl font-semibold text-[#0A1628] inline-flex items-center gap-2 mb-6">
          <LayoutGrid className="w-5 h-5 text-[#0D9373]" /> Browse by functional area
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kb-categories">
          {categories.map((c) => (
            <div key={c.slug} className="bg-white rounded-lg border border-[#E2E8F0] hover:border-[#0D9373]/40 hover:shadow-sm transition-all" data-testid={`category-${c.slug}`}>
              <Link to={`/knowledge-base/${c.slug}`} className="block p-5">
                <div className="flex items-start gap-3">
                  <CategoryIcon slug={c.slug} icon={c.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold text-[#0A1628]">{c.name}</div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      <span className="counter">{c.doc_count}</span> docs
                      {c.slug === mostActiveSlug && <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-[#0D9373]/10 text-[#0D9373] text-[10px] font-medium uppercase">Most active</span>}
                    </div>
                  </div>
                </div>
              </Link>
              {c.top_docs?.length > 0 && (
                <div className="border-t border-[#F1F5F9]">
                  {c.top_docs.map((td) => (
                    <Link key={td.id} to={`/knowledge-base/${c.slug}/${td.id}`} className="block px-5 py-2 text-sm text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0D9373] truncate">
                      {td.title}
                    </Link>
                  ))}
                  <Link to={`/knowledge-base/${c.slug}`} className="block px-5 py-2.5 text-xs font-medium text-[#0D9373] hover:bg-[#F8FAFC] border-t border-[#F1F5F9]">
                    View all {c.doc_count} <ArrowRight className="inline w-3 h-3 ml-0.5" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
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

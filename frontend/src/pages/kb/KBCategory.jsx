import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, ChevronRight, X } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge, VersionPill, CategoryIcon } from "../../components/kb/KBBadges";
import KBSidebar from "../../components/kb/KBSidebar";
import GroupBadge from "../../components/GroupBadge";
import { api } from "../../lib/api";

export default function KBCategory() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubModule = searchParams.get("sub") || null;

  const [cat, setCat] = useState(null);
  const [docs, setDocs] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get(`/kb/categories/${slug}`).then((r) => setCat(r.data)).catch(() => {});
    api.get(`/kb/docs?category=${slug}`).then((r) => setDocs(r.data.docs)).catch(() => {});
  }, [slug]);

  const visibleDocs = useMemo(() => {
    if (!activeSubModule) return docs;
    return docs.filter((d) => d.sub_module === activeSubModule);
  }, [docs, activeSubModule]);

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/knowledge-base/${slug}/search?q=${encodeURIComponent(query.trim())}`);
  };

  const clearSubModule = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("sub");
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-category">
      <NavHeader />
      <section className="bg-[#0A1628] text-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-12">
          <nav className="text-xs flex items-center gap-1.5 mb-5 text-white/70" data-testid="breadcrumb">
            <Link to="/knowledge-base" className="text-[#0D9373] hover:underline">Knowledge Base</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">{cat?.name}</span>
            {activeSubModule && (<><ChevronRight className="w-3 h-3" /><span className="text-white/80">{activeSubModule}</span></>)}
          </nav>
          {cat && (
            <>
              <div className="flex items-center gap-4">
                <CategoryIcon slug={cat.slug} icon={cat.icon} size="lg" />
                <div>
                  <h1 className="font-heading text-3xl lg:text-4xl font-bold tracking-tight" data-testid="category-name">{cat.name}</h1>
                  {activeSubModule && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-white/60">Filtered by:</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0D9373]/20 text-[#0D9373] text-xs font-semibold border border-[#0D9373]/30">
                        {activeSubModule}
                        <button onClick={clearSubModule} className="hover:opacity-70 ml-0.5"><X className="w-3 h-3" /></button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-4 text-white/70 max-w-2xl">{cat.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Pill>{cat.doc_count} docs total</Pill>
                {activeSubModule && <Pill>{visibleDocs.length} in this sub-module</Pill>}
                <Pill>{cat.avg_helpful_pct}% avg helpful</Pill>
                <Pill>{(cat.total_views || 0).toLocaleString()} total views</Pill>
              </div>
              <form onSubmit={submit} className="mt-7 flex gap-2 max-w-2xl">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                         placeholder={`Search within ${cat.name}…`} data-testid="category-search-input"
                         className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded text-sm placeholder:text-white/40 focus:bg-white/15 focus:border-white/40 outline-none" />
                </div>
                <button type="submit" className="px-5 py-2.5 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-sm font-medium" data-testid="category-search-submit">Search</button>
              </form>
            </>
          )}
        </div>
      </section>
      <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
        <KBSidebar activeSlug={slug} activeSubModule={activeSubModule} />
        <main className="flex-1 min-w-0">
          <section className="max-w-[900px] mx-auto px-6 lg:px-8 py-10">
            <div className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-4">
              {activeSubModule
                ? `${visibleDocs.length} document${visibleDocs.length === 1 ? "" : "s"} in "${activeSubModule}"`
                : `All ${docs.length} document${docs.length === 1 ? "" : "s"}`}
            </div>
            {activeSubModule && (
              <div className="mb-4 flex items-center gap-2 text-sm text-[#475569]">
                <span>Showing sub-module:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F5F0] text-[#0A7B59] text-xs font-semibold border border-[#0D9373]/20">
                  {activeSubModule}
                  <button onClick={clearSubModule} className="hover:opacity-60 ml-0.5"><X className="w-3 h-3" /></button>
                </span>
                <button onClick={clearSubModule} className="text-xs text-[#94A3B8] hover:text-[#475569] underline underline-offset-2">Show all</button>
              </div>
            )}
            <div className="flex flex-col gap-3" data-testid="kb-doc-list">
              {visibleDocs.map((d) => <DocRow key={d.id} doc={d} categorySlug={slug} />)}
              {visibleDocs.length === 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]">
                  {activeSubModule ? `No documents found in "${activeSubModule}".` : "No documents yet in this category."}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Pill({ children }) {
  return <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80">{children}</span>;
}

export function DocRow({ doc, categorySlug, highlightQuery }) {
  const titleNode = highlightQuery ? highlight(doc.title, highlightQuery) : doc.title;

  return (
    <Link to={`/knowledge-base/${categorySlug}/${doc.id}`}
          className="block bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373]/40 hover:shadow-sm transition-all"
          data-testid={`doc-row-${doc.id}`}>
      <div className="flex items-start gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <DocTypeBadge type={doc.doc_type} />
            <DifficultyBadge level={doc.difficulty} />
            <VersionPill version={doc.workday_version} />
            {doc.sub_module && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">{doc.sub_module}</span>
            )}
          </div>
          <h3 className="font-heading font-semibold text-[#0A1628] hover:text-[#0D9373]">{titleNode}</h3>
          <p className="text-sm text-[#64748B] mt-1.5 line-clamp-2">{doc.summary}</p>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#64748B]">
            <span className="font-medium text-[#0F172A]">{doc.author?.full_name}</span>
            <GroupBadge group={doc.author?.group_type} />
            <span className="counter">{doc.view_count} views</span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <span className="text-sm font-semibold text-[#16A34A] counter">{doc.helpful_pct}%</span>
          <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">helpful</span>
        </div>
      </div>
    </Link>
  );
}

export function highlight(text, q) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) => i % 2 === 1 ? <mark key={i} className="bg-[#FEF9C3] px-0.5 rounded text-[#0A1628] font-semibold">{p}</mark> : p);
}

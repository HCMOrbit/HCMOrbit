import React, { useEffect, useMemo, useState } from "react";
import { Newspaper, X } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import { NewsTile } from "../Ecosystem";
import { api } from "../../lib/api";

const SOURCES = ["UC Today", "HR Executive", "Workday News"];
const PAGE_SIZE = 30;

function FilterChip({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active ? "true" : "false"}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? "bg-[#0A1628] text-white border-[#0A1628]"
          : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#0D9373] hover:text-[#0D9373]"
      }`}
    >
      {children}
    </button>
  );
}

export default function EcosystemNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/news?limit=50")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled) setNews(Array.isArray(items) ? items : []);
      })
      .catch(() => { if (!cancelled) setNews([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Reset pagination whenever the filter changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [sourceFilter]);

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return news;
    return news.filter((n) => n.source === sourceFilter);
  }, [news, sourceFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const filterActive = sourceFilter !== "all";

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-news-page">
      <NavHeader />
      <EcosystemSubpageHero
        eyebrow="COMMUNITY NEWS"
        title="The latest from the Workday world"
        description="Headlines, release notes, and announcements from across the Workday ecosystem — refreshed hourly."
        current="News"
      />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        {/* Filter bar — only when we have stories to filter */}
        {!loading && news.length > 0 && (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-4 lg:p-5 mb-6 flex flex-wrap items-center gap-2"
            data-testid="news-filter-bar"
          >
            <span className="text-xs uppercase tracking-wider font-semibold text-[#64748B] mr-1">
              Source
            </span>
            <FilterChip
              active={sourceFilter === "all"}
              onClick={() => setSourceFilter("all")}
              testId="news-filter-source-all"
            >
              All
            </FilterChip>
            {SOURCES.map((src) => (
              <FilterChip
                key={src}
                active={sourceFilter === src}
                onClick={() => setSourceFilter(src)}
                testId={`news-filter-source-${src.replace(/\s+/g, "-")}`}
              >
                {src}
              </FilterChip>
            ))}
            {filterActive && (
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                data-testid="news-filter-clear"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0D9373] hover:text-[#0b7c61]"
              >
                <X className="w-3.5 h-3.5" /> Clear filter
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2.5">
            <Newspaper className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">
              {filterActive ? "Filtered news" : "All news"}
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-[#64748B]" data-testid="news-count">
              {filterActive
                ? <>{filtered.length} of {news.length} {news.length === 1 ? "story" : "stories"}</>
                : <>{news.length} {news.length === 1 ? "story" : "stories"}</>}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-[#64748B] py-12 text-center" data-testid="news-loading">
            Loading news…
          </div>
        ) : news.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="news-empty"
          >
            <Newspaper className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B]">No community news yet. Check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="news-filtered-empty"
          >
            <Newspaper className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B] mb-3">No stories from this source yet.</p>
            <button
              type="button"
              onClick={() => setSourceFilter("all")}
              data-testid="news-filtered-empty-clear"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9373] hover:text-[#0b7c61]"
            >
              <X className="w-3.5 h-3.5" /> Clear filter
            </button>
          </div>
        ) : (
          <>
            <div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
              data-testid="news-list"
            >
              {visible.map((n, i) => (
                <NewsTile key={n.id || n.url || i} n={n} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  data-testid="news-load-more"
                  className="px-6 py-2.5 rounded-md border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0A1628] hover:border-[#0D9373] hover:text-[#0D9373] transition-colors"
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

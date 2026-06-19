import React, { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import { NewsTile } from "../Ecosystem";
import { api } from "../../lib/api";

export default function EcosystemNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2.5">
            <Newspaper className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">
              All news
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-[#64748B]" data-testid="news-count">
              {news.length} {news.length === 1 ? "story" : "stories"}
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
        ) : (
          <div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            data-testid="news-list"
          >
            {news.map((n, i) => (
              <NewsTile key={n.id || n.url || i} n={n} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

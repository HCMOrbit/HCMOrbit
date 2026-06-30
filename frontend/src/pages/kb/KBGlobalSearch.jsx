import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { DocRow } from "./KBCategory";
import { api } from "../../lib/api";

/**
 * KBGlobalSearch — global, all-area KB search results.
 *
 * Mounted at /knowledge-base/search?q=… (sibling of the per-category search
 * page at /knowledge-base/:slug/search). Calls GET /api/kb/docs?q=…&limit=50
 * with no `category` param so results span every published area.
 *
 * Result cards reuse `DocRow` from KBCategory.jsx so global hits look
 * identical to category-scoped hits. The per-doc `category_slug` (returned
 * by the API) feeds DocRow so each result links to the correct article.
 */
export default function KBGlobalSearch() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [query, setQuery] = useState(q);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQuery(q); }, [q]);

  useEffect(() => {
    if (!q) { setDocs([]); return; }
    setLoading(true);
    api.get(`/kb/docs?q=${encodeURIComponent(q)}&limit=50`)
      .then((r) => setDocs(r.data.docs || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setParams({ q: term });
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-global-search">
      <NavHeader />
      <section className="bg-[#0A1628] text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10">
          <nav className="text-xs flex items-center gap-1.5 mb-4 text-white/70">
            <Link to="/knowledge-base" className="text-[#0D9373] hover:underline">Knowledge Base</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Search results</span>
          </nav>
          <h1 className="font-heading text-2xl font-semibold mb-5">Search all guides</h1>
          <form onSubmit={submit} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across every functional area…"
                data-testid="kb-global-search-input"
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded text-sm placeholder:text-white/40 focus:bg-white/15 focus:border-white/40 outline-none"
              />
            </div>
            <button
              type="submit"
              data-testid="kb-global-search-submit"
              className="px-5 py-2.5 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6">
        {!q ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]" data-testid="kb-global-search-prompt">
            Type a term above to search the full Knowledge Base.
          </div>
        ) : (
          <>
            <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 mb-4 text-sm text-[#64748B] inline-flex items-center gap-2">
              <SearchIcon className="w-4 h-4" />
              <span data-testid="kb-global-search-meta">
                {loading
                  ? `Searching for “${q}”…`
                  : `${docs.length} ${docs.length === 1 ? "result" : "results"} for “${q}” across all areas`}
              </span>
            </div>
            <div className="flex flex-col gap-3" data-testid="kb-global-search-results">
              {!loading && docs.length === 0 ? (
                <div
                  className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center"
                  data-testid="kb-global-search-empty"
                >
                  <div className="font-heading font-semibold text-[#0A1628]">
                    No guides match “{q}”
                  </div>
                  <button
                    onClick={() => navigate("/knowledge-base")}
                    className="mt-3 text-sm text-[#0D9373] hover:underline"
                  >
                    Back to the Knowledge Base →
                  </button>
                </div>
              ) : docs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  categorySlug={d.category_slug}
                  highlightQuery={q}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

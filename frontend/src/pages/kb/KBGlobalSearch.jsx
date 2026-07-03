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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQuery(q); }, [q]);

  useEffect(() => {
    if (!q) { setDocs([]); setTotal(0); return; }
    setLoading(true);
    api.get(`/kb/docs?q=${encodeURIComponent(q)}&limit=200`)
      .then((r) => {
        setDocs(r.data.docs || []);
        setTotal(typeof r.data.total === "number" ? r.data.total : (r.data.docs || []).length);
      })
      .catch(() => { setDocs([]); setTotal(0); })
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
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-8">
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
            borderRadius: 18,
            padding: "38px 32px",
            color: "#ffffff",
          }}
          data-testid="kb-global-search-hero"
        >
          <nav className="text-xs flex items-center gap-1.5 mb-5 text-white/70">
            <Link to="/knowledge-base" className="hover:underline" style={{ color: "#F5B731" }}>Knowledge Base</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Search results</span>
          </nav>
          <div
            style={{
              color: "#F5B731", fontSize: 15, fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
            }}
            data-testid="kb-global-search-eyebrow"
          >
            Knowledge Base
          </div>
          <h1 className="font-heading" style={{ color: "#fff", fontSize: 44, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 24 }}>
            Search all guides
          </h1>
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
              className="px-5 py-2.5 rounded text-sm font-semibold"
              style={{ background: "#F5B731", color: "#0a1628" }}
            >
              Search
            </button>
          </form>
        </section>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-6">
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
                  : `${total} ${total === 1 ? "result" : "results"} for “${q}” across all areas`}
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

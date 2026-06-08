import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import NavHeader from "../components/NavHeader";
import CommunityLayout from "../components/CommunityLayout";
import PostCard from "../components/PostCard";
import { api } from "../lib/api";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const q = params.get("q") || "";

  useEffect(() => {
    if (!q) { setPosts([]); setTotal(0); return; }
    setLoading(true);
    api.get(`/posts?q=${encodeURIComponent(q)}&limit=30`)
      .then((r) => { setPosts(r.data.posts); setTotal(r.data.total); })
      .catch(() => { setPosts([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) setParams({ q: query.trim() });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="search-page">
      <NavHeader />
      <CommunityLayout rightSidebar={false}>
        <div className="mb-5">
          <Link to="/community" className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0A1628]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to community
          </Link>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mt-2">Search</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Find posts by title, tag, or body.</p>
        </div>

        <form onSubmit={submit} className="relative mb-6">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="EIB, XSLT, intersection security, payroll cutover..."
            autoFocus
            data-testid="search-input"
            className="w-full pl-10 pr-4 py-3 bg-white border border-[#E2E8F0] rounded-lg focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm"
          />
        </form>

        {q && (
          <div className="text-xs text-[#64748B] mb-3" data-testid="search-meta">
            {loading ? "Searching..." : `${total} ${total === 1 ? "result" : "results"} for "${q}"`}
          </div>
        )}

        <div className="flex flex-col gap-3" data-testid="search-results">
          {!q ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]">
              Start typing to search across all posts.
            </div>
          ) : loading ? null : posts.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center" data-testid="search-empty">
              <div className="font-heading font-semibold text-[#0A1628]">No matches for &ldquo;{q}&rdquo;.</div>
              <p className="text-sm text-[#64748B] mt-1">Try a different keyword or browse by space.</p>
            </div>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </CommunityLayout>
    </div>
  );
}

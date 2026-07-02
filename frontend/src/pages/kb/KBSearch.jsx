import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { CategoryIcon } from "../../components/kb/KBBadges";
import { DocRow } from "./KBCategory";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const TYPES = [
  { id: "all", label: "All types" },
  { id: "fix_guide", label: "Fix guide" },
  { id: "how_to", label: "How-to" },
  { id: "learning_bite", label: "Learning bite" },
  { id: "reference", label: "Reference" },
  { id: "checklist", label: "Checklist" },
];
const LEVELS = [
  { id: "all", label: "All levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export default function KBSearch() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [query, setQuery] = useState(q);
  const [cat, setCat] = useState(null);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("all");
  const [level, setLevel] = useState("all");
  const [version, setVersion] = useState("all");

  useEffect(() => { api.get(`/kb/categories/${slug}`).then((r) => setCat(r.data)).catch(() => {}); }, [slug]);
  useEffect(() => {
    if (!q) { setDocs([]); setTotal(0); return; }
    api.get(`/kb/docs?category=${slug}&q=${encodeURIComponent(q)}&limit=200`)
      .then((r) => {
        setDocs(r.data.docs || []);
        setTotal(typeof r.data.total === "number" ? r.data.total : (r.data.docs || []).length);
      })
      .catch(() => { setDocs([]); setTotal(0); });
  }, [slug, q]);

  const versions = useMemo(() => Array.from(new Set(docs.map((d) => d.workday_version).filter(Boolean))).sort().reverse(), [docs]);

  const filtered = docs.filter((d) =>
    (type === "all" || d.doc_type === type) &&
    (level === "all" || d.difficulty === level) &&
    (version === "all" || d.workday_version === version)
  );

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) setParams({ q: query.trim() });
  };

  const typeCounts = useMemo(() => {
    const c = { all: docs.length };
    docs.forEach((d) => { c[d.doc_type] = (c[d.doc_type] || 0) + 1; });
    return c;
  }, [docs]);
  const levelCounts = useMemo(() => {
    const c = { all: docs.length };
    docs.forEach((d) => { c[d.difficulty] = (c[d.difficulty] || 0) + 1; });
    return c;
  }, [docs]);
  const versionCounts = useMemo(() => {
    const c = { all: docs.length };
    docs.forEach((d) => { if (d.workday_version) c[d.workday_version] = (c[d.workday_version] || 0) + 1; });
    return c;
  }, [docs]);

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-search">
      <NavHeader />
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-8">
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #0d2d3a 100%)",
            borderRadius: 18,
            padding: "38px 32px",
            color: "#ffffff",
          }}
          data-testid="kb-search-hero"
        >
          <nav className="text-xs flex items-center gap-1.5 mb-5 text-white/70">
            <Link to="/knowledge-base" className="hover:text-white" style={{ color: "#F5B731" }}>Knowledge Base</Link>
            <ChevronRight className="w-3 h-3" />
            {cat && <Link to={`/knowledge-base/${slug}`} className="hover:text-white" style={{ color: "#F5B731" }}>{cat.name}</Link>}
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Search results</span>
          </nav>
          <div
            style={{
              color: "#F5B731", fontSize: 15, fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
            }}
          >
            {cat ? cat.name : "Knowledge Base"}
          </div>
          {cat && (
            <div className="flex items-center gap-3 mb-5">
              <CategoryIcon slug={cat.slug} icon={cat.icon} />
              <h1 className="font-heading" style={{ color: "#fff", fontSize: 36, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Search this area
              </h1>
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search within ${cat?.name || ""}...`} data-testid="search-input"
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded text-sm placeholder:text-white/40 focus:bg-white/15 focus:border-white/40 outline-none" />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded text-sm font-semibold" style={{ background: "#F5B731", color: "#0a1628" }}>Search</button>
          </form>
        </section>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6 flex gap-5">
        <aside className="w-[170px] shrink-0 hidden md:block bg-white rounded-lg border border-[#E2E8F0] p-4 h-fit sticky top-20" data-testid="kb-sidebar">
          <FilterGroup label="Type" items={TYPES.map((t) => ({ ...t, count: typeCounts[t.id] || 0 }))} value={type} onChange={setType} />
          <div className="border-t border-[#F1F5F9] my-3" />
          <FilterGroup label="Level" items={LEVELS.map((l) => ({ ...l, count: levelCounts[l.id] || 0 }))} value={level} onChange={setLevel} />
          {versions.length > 0 && (<>
            <div className="border-t border-[#F1F5F9] my-3" />
            <FilterGroup label="Version" items={[{ id: "all", label: "All versions", count: docs.length }, ...versions.map((v) => ({ id: v, label: v, count: versionCounts[v] || 0 }))]} value={version} onChange={setVersion} />
          </>)}
        </aside>
        <main className="flex-1 min-w-0">
          <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 mb-4 text-sm text-[#64748B] inline-flex items-center gap-2">
            <SearchIcon className="w-4 h-4" />
            <span data-testid="search-meta">
              {(type === "all" && level === "all" && version === "all")
                ? `${total} ${total === 1 ? "result" : "results"} for "${q}"`
                : `${filtered.length} of ${total} ${total === 1 ? "result" : "results"} for "${q}"`}
            </span>
          </div>
          <div className="flex flex-col gap-3" data-testid="search-results">
            {filtered.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center">
                <div className="font-heading font-semibold text-[#0A1628]">No documents match your search.</div>
                {user?.is_admin && (
                  <button onClick={() => navigate("/knowledge-base/new")} className="mt-3 text-sm text-[#0D9373] hover:underline">Add a document →</button>
                )}
              </div>
            ) : filtered.map((d) => <DocRow key={d.id} doc={d} categorySlug={slug} highlightQuery={q} />)}
          </div>
        </main>
      </div>
    </div>
  );
}

function FilterGroup({ label, items, value, onChange }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-2">{label}</div>
      <div className="flex flex-col gap-0.5">
        {items.map((it) => (
          <button key={it.id} onClick={() => onChange(it.id)}
            className={`flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors ${value === it.id ? "bg-[#F0FDF4] text-[#0D9373] font-medium border-l-2 border-[#0D9373]" : "text-[#475569] hover:bg-[#F8FAFC]"}`}
            data-testid={`filter-${label.toLowerCase()}-${it.id}`}>
            <span>{it.label}</span>
            <span className="text-[#94A3B8] counter">{it.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

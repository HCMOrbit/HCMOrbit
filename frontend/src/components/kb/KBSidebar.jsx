import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Search, X, Layers } from "lucide-react";
import { CAT_BG } from "./KBBadges";
import { api } from "../../lib/api";

const SIDEBAR_BG = "#FFFFFF";
const ACTIVE_BG  = "#E8F5F0";
const ACTIVE_TXT = "#0A7B59";
const HOVER_BG   = "#F8FAFC";
const BORDER     = "#E2E8F0";
const BRAND_NAVY = "#0A1628";
const TEAL       = "#0D9373";

function ModuleRow({ cat, activeSlug, activeSubModule, subModules }) {
  const isActive = cat.slug === activeSlug;
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const subs  = subModules[cat.slug] || [];
  const count = cat.doc_count || 0;

  return (
    <div className="mb-0.5">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer select-none group transition-colors"
        style={{ background: isActive && !open ? ACTIVE_BG : "transparent" }}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => { if (!isActive || open) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = isActive && !open ? ACTIVE_BG : "transparent"; }}
      >
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
              style={{ background: CAT_BG[cat.slug] || "#F1F5F9" }}>
          {cat.icon}
        </span>
        <span className="flex-1 min-w-0 text-[13px] font-semibold leading-tight"
              style={{ color: isActive ? ACTIVE_TXT : BRAND_NAVY, wordBreak: "break-word" }}>
          {cat.name}
        </span>
        {count > 0 && (
          <span className="text-[10px] font-medium shrink-0" style={{ color: "#94A3B8" }}>{count}</span>
        )}
        <span className="shrink-0 transition-transform" style={{ color: "#94A3B8" }}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </div>
      {open && (
        <div className="ml-9 mt-0.5 mb-1 flex flex-col gap-px">
          <Link
            to={`/knowledge-base/${cat.slug}`}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors"
            style={{
              color: isActive && !activeSubModule ? ACTIVE_TXT : "#475569",
              background: isActive && !activeSubModule ? ACTIVE_BG : "transparent",
              fontWeight: isActive && !activeSubModule ? 600 : 400,
            }}
          >
            <Layers className="w-3 h-3 shrink-0 opacity-60" />
            All documents
          </Link>
          {subs.map((sm) => {
            const isActiveSub = isActive && activeSubModule === sm.sub_module;
            return (
              <Link
                key={sm.sub_module}
                to={`/knowledge-base/${cat.slug}?sub=${encodeURIComponent(sm.sub_module)}`}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors"
                style={{
                  color: isActiveSub ? ACTIVE_TXT : "#475569",
                  background: isActiveSub ? ACTIVE_BG : "transparent",
                  fontWeight: isActiveSub ? 600 : 400,
                }}
              >
                <span className="w-1 h-1 rounded-full shrink-0 mt-px"
                      style={{ background: isActiveSub ? TEAL : "#CBD5E1" }} />
                <span className="truncate">{sm.sub_module}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KBSidebar({ activeSlug, activeSubModule, width = 256 }) {
  const [categories, setCategories] = useState([]);
  const [subModules, setSubModules] = useState({});
  const [search, setSearch]         = useState("");

  useEffect(() => {
    api.get("/kb/categories").then((r) => setCategories(r.data)).catch(() => {});
    // Single bulk call: hydrate sub-modules for every populated category at once
    api.get("/kb/submodules?all=true").then((r) => setSubModules(r.data || {})).catch(() => {});
  }, []);

  const ordered = [...categories].sort((a, b) => {
    const aHas = (a.doc_count || 0) > 0;
    const bHas = (b.doc_count || 0) > 0;
    if (aHas !== bHas) return bHas ? 1 : -1;
    return (a.sort_order || 99) - (b.sort_order || 99);
  });

  const filtered = search.trim()
    ? ordered.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : ordered;

  return (
    <aside
      className="sticky top-[64px] self-start h-[calc(100vh-64px)] flex flex-col overflow-hidden"
      style={{ width, minWidth: width, maxWidth: width, background: SIDEBAR_BG, borderRight: `1px solid ${BORDER}` }}
      data-testid="kb-sidebar"
    >
      <div className="px-4 pt-5 pb-3 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <Link to="/knowledge-base"
              className="block text-[11px] font-bold uppercase tracking-widest mb-3 hover:opacity-70 transition-opacity"
              style={{ color: TEAL }}>
          Knowledge Base
        </Link>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter modules…"
            className="w-full pl-8 pr-7 py-1.5 text-[12px] rounded-md outline-none"
            style={{ background: "#F8FAFC", border: `1px solid ${BORDER}`, color: BRAND_NAVY }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
        data-testid="kb-sidebar-nav"
      >
        {filtered.map((cat) => (
          <ModuleRow
            key={cat.slug}
            cat={cat}
            activeSlug={activeSlug}
            activeSubModule={activeSubModule}
            subModules={subModules}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px]" style={{ color: "#94A3B8" }}>
            No modules match &ldquo;{search}&rdquo;
          </div>
        )}
      </nav>
      <div className="px-4 py-3 shrink-0 text-[11px]"
           style={{ borderTop: `1px solid ${BORDER}`, color: "#94A3B8" }}>
        {categories.reduce((s, c) => s + (c.doc_count || 0), 0).toLocaleString()} documents across {categories.filter((c) => (c.doc_count || 0) > 0).length} modules
      </div>
    </aside>
  );
}

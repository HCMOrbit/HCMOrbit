import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText, Users, Download, Edit3, TrendingUp, ChevronDown, ChevronUp,
  X, Loader2, RefreshCw, ArrowUpDown, AlertCircle,
} from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";

// ── Small helpers ──────────────────────────────────────────────────────────
const fmtInt = (n) => (n == null ? "0" : Number(n).toLocaleString());
const fmtPct = (r) => (r == null ? "0%" : `${Math.round(r * 100)}%`);
const fmtMedian = (n) => (n == null ? "0" : (Math.round(n * 10) / 10).toString());
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const fmtDur = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

const MODULES = [
  "Core HCM","Payroll","Absence","Time Tracking","Benefits","Recruiting",
  "Talent","Security","Integrations","Reporting","Financials",
];

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminDocwright() {
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.get("/admin/docwright/stats")
      .then((r) => setStats(r.data))
      .catch((e) => setStatsErr(formatApiError(e)));
  }, [reloadKey]);

  return (
    <AdminLayout>
      <div className="space-y-6 min-w-0" data-testid="admin-docwright">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Docwright</h1>
            <p className="text-sm text-[#64748B] mt-1">Generated documents, per-user activity, and raw notes-vs-output.</p>
          </div>
          <button
            type="button" onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:text-[#0A1628] hover:border-[#0D9373]"
            data-testid="admin-docwright-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {statsErr && (
          <div className="text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded px-3 py-2 flex items-center gap-2" data-testid="admin-docwright-error">
            <AlertCircle className="w-3.5 h-3.5" /> {statsErr}
          </div>
        )}

        <StatsStrip stats={stats} />
        <DocumentList reloadKey={reloadKey} />
        <UserTable reloadKey={reloadKey} />
      </div>
    </AdminLayout>
  );
}

// ── Section 1: stats strip ─────────────────────────────────────────────────
function StatsStrip({ stats }) {
  const items = [
    { label: "Documents generated",         value: fmtInt(stats?.total_docs), icon: FileText },
    { label: "Users with 1+ doc",           value: fmtInt(stats?.users_with_docs), icon: Users },
    { label: "Repeat rate (2+ docs)",       value: fmtPct(stats?.repeat_rate),
      hint: stats ? `${stats.repeat_users} repeat users` : "" , icon: TrendingUp },
    { label: "Download rate",               value: fmtPct(stats?.download_rate),
      hint: stats ? `${stats.downloaded_count} downloaded` : "", icon: Download },
    { label: "Median sections edited",      value: fmtMedian(stats?.median_sections_edited), icon: Edit3 },
    { label: "Median OPEN ITEMs / doc",     value: fmtMedian(stats?.median_open_items), icon: AlertCircle },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="admin-docwright-stats">
      {items.map((it) => (
        <div key={it.label} className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">{it.label}</div>
            <div className="w-7 h-7 rounded bg-[#0D9373]/10 flex items-center justify-center">
              <it.icon className="w-3.5 h-3.5 text-[#0D9373]" />
            </div>
          </div>
          <div className="mt-2 font-heading text-2xl font-bold text-[#0A1628]" data-testid={`admin-docwright-stat-${it.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {stats == null ? "…" : it.value}
          </div>
          {it.hint && <div className="text-[11px] text-[#94A3B8] mt-0.5">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Section 2: document list ───────────────────────────────────────────────
const DOC_COLUMNS = [
  { key: "created_at", label: "Created", sortable: true },
  { key: "user_email", label: "User", sortable: true },
  { key: "client_name", label: "Client", sortable: true },
  { key: "module", label: "Module", sortable: true },
  { key: "doc_type", label: "Doc type", sortable: true },
  { key: "open_items_count", label: "OPEN ITEMs", sortable: true, align: "right" },
  { key: "sections_edited_count", label: "Edited", sortable: true, align: "right" },
  { key: "downloaded_at", label: "DL?", sortable: true, align: "center" },
  { key: "generation_duration_ms", label: "Gen time", sortable: true, align: "right" },
];

function DocumentList({ reloadKey }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [module, setModule] = useState("");
  const [downloaded, setDownloaded] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page), page_size: String(pageSize),
      sort_by: sortBy, sort_dir: sortDir,
    });
    if (module) params.set("module", module);
    if (downloaded) params.set("downloaded", downloaded);
    api.get(`/admin/docwright/documents?${params}`)
      .then((r) => { setData(r.data); setErr(null); })
      .catch((e) => setErr(formatApiError(e)));
  }, [page, pageSize, sortBy, sortDir, module, downloaded, reloadKey]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const total = data?.total || 0;
  const rows = data?.documents || [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden min-w-0" data-testid="admin-docwright-docs">
      <header className="px-4 py-3 border-b border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-[#0A1628]">Documents <span className="text-sm text-[#64748B] font-normal">({fmtInt(total)})</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:border-[#0D9373]"
                  data-testid="admin-docwright-filter-module">
            <option value="">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={downloaded} onChange={(e) => { setDownloaded(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:border-[#0D9373]"
                  data-testid="admin-docwright-filter-downloaded">
            <option value="">Downloaded: any</option>
            <option value="yes">Downloaded: yes</option>
            <option value="no">Downloaded: no</option>
          </select>
        </div>
      </header>

      {err && <div className="px-4 py-2 text-xs text-[#B91C1C]">{err}</div>}

      <div className="overflow-x-auto" data-testid="admin-docwright-docs-scroll">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
            <tr>
              {DOC_COLUMNS.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 hover:text-[#0A1628]"
                            data-testid={`admin-docwright-sort-${c.key}`}>
                      {c.label}
                      {sortBy === c.key
                        ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && data && (
              <tr><td colSpan={DOC_COLUMNS.length} className="px-3 py-10 text-center text-[#94A3B8]">No documents match.</td></tr>
            )}
            {rows.map((d) => (
              <tr key={d.id}
                  onClick={() => setOpenId(d.id)}
                  className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer"
                  data-testid={`admin-docwright-row-${d.id}`}>
                <td className="px-3 py-2 text-[#475569] whitespace-nowrap">{fmtDate(d.created_at)}</td>
                <td className="px-3 py-2 text-[#0A1628] whitespace-nowrap max-w-[180px] truncate" title={d.user_email}>{d.user_email}</td>
                <td className="px-3 py-2 text-[#0A1628] font-medium whitespace-nowrap max-w-[180px] truncate" title={d.client_name}>{d.client_name}</td>
                <td className="px-3 py-2 text-[#475569] whitespace-nowrap">{d.module}</td>
                <td className="px-3 py-2 text-[#475569] whitespace-nowrap">{d.doc_type}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${d.open_items_count > 0 ? "text-[#8A6100] font-semibold" : "text-[#475569]"}`}>
                  {fmtInt(d.open_items_count)}
                </td>
                <td className="px-3 py-2 text-right text-[#475569] whitespace-nowrap">{fmtInt(d.sections_edited_count)}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {d.downloaded_at
                    ? <span className="inline-block px-1.5 py-0.5 rounded bg-[#0D9373]/10 text-[#0D9373] text-[10px] font-semibold uppercase">Yes</span>
                    : <span className="text-[#CBD5E1] text-[11px]">—</span>}
                </td>
                <td className="px-3 py-2 text-right text-[#475569] whitespace-nowrap">{fmtDur(d.generation_duration_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]" data-testid="admin-docwright-pager">
        <div>Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-2.5 py-1 rounded border border-[#E2E8F0] hover:border-[#0D9373] disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-2.5 py-1 rounded border border-[#E2E8F0] hover:border-[#0D9373] disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      </div>

      {openId && <DocumentDetailDrawer docId={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

// ── Document detail drawer (raw notes ⇔ generated output side-by-side) ────
function DocumentDetailDrawer({ docId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setDoc(null); setErr(null);
    api.get(`/admin/docwright/documents/${docId}`)
      .then((r) => setDoc(r.data))
      .catch((e) => setErr(formatApiError(e)));
  }, [docId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const sections = doc?.generated_sections || {};
  const sectionOrder = [
    ["document_control", "Document Control"], ["purpose_scope", "Purpose & Scope"],
    ["business_requirements", "Business Requirements"], ["design_decisions", "Design Decisions"],
    ["configuration_detail", "Configuration Detail"], ["assumptions_dependencies", "Assumptions & Dependencies"],
    ["open_items", "Open Items / Parking Lot"], ["testing_considerations", "Testing Considerations"],
    ["approvals", "Approvals"],
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" data-testid="admin-docwright-detail">
      <div className="absolute inset-0 bg-[#0A1628]/60" onClick={onClose} data-testid="admin-docwright-detail-backdrop" />
      <aside className="absolute top-0 right-0 h-full w-full lg:w-[92%] max-w-[1400px] bg-[#F8FAFC] shadow-2xl flex flex-col">
        <header className="h-16 px-4 lg:px-6 flex items-center justify-between border-b border-[#E2E8F0] shrink-0 bg-white">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#0D9373]">
              {doc?.doc_type || "…"}
            </div>
            <div className="font-heading font-bold text-[#0A1628] truncate">
              {doc ? `${doc.client_name} — ${doc.module}` : "Loading…"}
              {doc && <span className="ml-2 text-xs text-[#64748B] font-normal">by {doc.user_email || doc.user_id}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9]"
                  data-testid="admin-docwright-detail-close">
            <X className="w-5 h-5" />
          </button>
        </header>

        {err && <div className="p-4 text-xs text-[#B91C1C]">{err}</div>}
        {!doc && !err && (
          <div className="flex-1 flex items-center justify-center text-[#64748B] text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…</div>
        )}
        {doc && (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Raw notes */}
            <div className="border-r border-[#E2E8F0] flex flex-col min-h-0">
              <div className="px-4 lg:px-6 py-3 border-b border-[#F1F5F9] bg-white">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Raw notes (input)</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 lg:p-6" data-testid="admin-docwright-detail-notes">
                <pre className="whitespace-pre-wrap text-sm font-mono text-[#0F172A] leading-relaxed">
                  {doc.raw_notes || "(no notes)"}
                </pre>
              </div>
            </div>
            {/* Generated output */}
            <div className="flex flex-col min-h-0 bg-white">
              <div className="px-4 lg:px-6 py-3 border-b border-[#F1F5F9]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#0D9373]">Generated document (read-only)</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6" data-testid="admin-docwright-detail-output">
                {sectionOrder.map(([key, label]) => (
                  <section key={key}>
                    <h3 className="font-heading font-bold text-base text-[#0A1628] border-b border-[#E2E8F0] pb-1 mb-2">{label}</h3>
                    <div className="docwright-md prose prose-sm max-w-none text-[#0F172A]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {sections[key] || "_(empty)_"}
                      </ReactMarkdown>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const mdComponents = {
  table: ({ node, ...p }) => <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse text-xs" {...p} /></div>,
  th: ({ node, ...p }) => <th className="border border-[#CBD5E1] bg-[#F1F5F9] px-2 py-1.5 text-left font-semibold" {...p} />,
  td: ({ node, ...p }) => <td className="border border-[#CBD5E1] px-2 py-1.5 align-top" {...p} />,
  strong: ({ node, children, ...p }) => {
    const raw = React.Children.toArray(children).map((c) => (typeof c === "string" ? c : "")).join("");
    if (/OPEN ITEM:/i.test(raw)) return <strong className="bg-[#FEF3C7] text-[#8A6100] px-1 rounded" {...p}>{children}</strong>;
    return <strong {...p}>{children}</strong>;
  },
};

// ── Section 3: user table (collapsed by default) ──────────────────────────
const USER_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "docs_created", label: "Docs", align: "right" },
  { key: "docs_downloaded", label: "Downloaded", align: "right" },
  { key: "sections_edited", label: "Sections edited", align: "right" },
  { key: "regenerates", label: "Regenerates", align: "right" },
  { key: "first_doc", label: "First doc" },
  { key: "last_doc", label: "Last doc" },
  { key: "distinct_days_active", label: "Active days", align: "right" },
];

function UserTable({ reloadKey }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [sortBy, setSortBy] = useState("last_doc");
  const [sortDir, setSortDir] = useState("desc");
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!expanded) return;
    api.get(`/admin/docwright/users?sort_by=${sortBy}&sort_dir=${sortDir}`)
      .then((r) => { setData(r.data); setErr(null); })
      .catch((e) => setErr(formatApiError(e)));
  }, [expanded, sortBy, sortDir, reloadKey]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const users = data?.users || [];

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden min-w-0" data-testid="admin-docwright-users">
      <button
        type="button" onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F8FAFC]"
        aria-expanded={expanded}
        data-testid="admin-docwright-users-toggle"
      >
        <h2 className="font-heading font-semibold text-[#0A1628]">Users {data && <span className="text-sm text-[#64748B] font-normal">({fmtInt(users.length)})</span>}</h2>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {expanded && (
        <>
          {err && <div className="px-4 py-2 text-xs text-[#B91C1C]">{err}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                <tr>
                  {USER_COLUMNS.map((c) => (
                    <th key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                      <button type="button" onClick={() => toggleSort(c.key)}
                              className="inline-flex items-center gap-1 hover:text-[#0A1628]"
                              data-testid={`admin-docwright-user-sort-${c.key}`}>
                        {c.label}
                        {sortBy === c.key
                          ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                          : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!data && <tr><td colSpan={USER_COLUMNS.length} className="px-3 py-10 text-center text-[#94A3B8]"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…</td></tr>}
                {data && users.length === 0 && (
                  <tr><td colSpan={USER_COLUMNS.length} className="px-3 py-10 text-center text-[#94A3B8]">No users yet.</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.user_id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`admin-docwright-user-row-${u.user_id}`}>
                    <td className="px-3 py-2 text-[#0A1628] font-medium whitespace-nowrap">{u.email}</td>
                    <td className="px-3 py-2 text-right text-[#475569]">{fmtInt(u.docs_created)}</td>
                    <td className="px-3 py-2 text-right text-[#475569]">{fmtInt(u.docs_downloaded)}</td>
                    <td className="px-3 py-2 text-right text-[#475569]">{fmtInt(u.sections_edited)}</td>
                    <td className="px-3 py-2 text-right text-[#475569]">{fmtInt(u.regenerates)}</td>
                    <td className="px-3 py-2 text-[#475569] whitespace-nowrap">{fmtDate(u.first_doc)}</td>
                    <td className="px-3 py-2 text-[#475569] whitespace-nowrap">{fmtDate(u.last_doc)}</td>
                    <td className="px-3 py-2 text-right text-[#475569]">{fmtInt(u.distinct_days_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

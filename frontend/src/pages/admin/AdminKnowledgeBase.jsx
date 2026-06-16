import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { Plus, Search as SearchIcon, MoreVertical, ExternalLink, Star, StarOff, Eye, EyeOff, BookOpen, FileText, FileEdit, Layers, Upload, ChevronDown, ChevronRight } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import ConfirmModal from "../../components/ConfirmModal";
import { DocTypeBadge, DifficultyBadge } from "../../components/kb/KBBadges";
import KBDocxUploadModal from "./KBDocxUploadModal";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "featured", label: "Featured" },
];

export default function AdminKnowledgeBase() {
  const [stats, setStats] = useState({});
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [confirm, setConfirm] = useState(null);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  // Collapsed group keys (default: all expanded -> empty set)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Build ordered groups: { key, label, docs[] } sorted by Module → Sub-module → title
  const groupedDocs = React.useMemo(() => {
    const map = new Map();
    for (const d of docs) {
      const module = d.category?.name || "Uncategorized";
      const sub = d.sub_module?.trim() || "—";
      const key = `${module}__${sub}`;
      if (!map.has(key)) map.set(key, { key, module, sub, docs: [] });
      map.get(key).docs.push(d);
    }
    const groups = Array.from(map.values());
    groups.sort((a, b) => a.module.localeCompare(b.module) || a.sub.localeCompare(b.sub));
    // Sort docs within each group by reference_id numerically (TA-JOBREQ-KB-001
    // before TA-JOBREQ-KB-010). Docs missing a reference_id fall to the end
    // and are sorted alphabetically among themselves.
    for (const g of groups) {
      g.docs.sort((a, b) => {
        const ra = (a.reference_id || "").trim();
        const rb = (b.reference_id || "").trim();
        if (ra && !rb) return -1;
        if (!ra && rb) return 1;
        if (ra && rb) return ra.localeCompare(rb, undefined, { numeric: true, sensitivity: "base" });
        return (a.title || "").localeCompare(b.title || "");
      });
    }
    return groups;
  }, [docs]);

  const loadStats = useCallback(() => {
    api.get("/admin/kb/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const loadCategories = useCallback(() => {
    api.get("/admin/kb/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const loadDocs = useCallback(() => {
    const params = new URLSearchParams({ page, page_size: 25 });
    if (q) params.set("q", q);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    api.get(`/admin/kb/docs?${params}`)
      .then((r) => { setDocs(r.data.docs); setTotal(r.data.total); })
      .catch(() => {});
  }, [q, statusFilter, categoryFilter, page]);

  useEffect(loadStats, [loadStats]);
  useEffect(loadCategories, [loadCategories]);
  useEffect(loadDocs, [loadDocs]);

  const patchDoc = async (docId, updates, msg) => {
    try {
      await api.patch(`/admin/kb/docs/${docId}`, updates);
      toast.success(msg);
      loadDocs();
      loadStats();
    } catch (e) { toast.error(formatApiError(e)); }
    setOpenMenuId(null);
    setConfirm(null);
  };

  const deleteDoc = async (docId) => {
    try {
      await api.delete(`/admin/kb/docs/${docId}`);
      toast.success("Document deleted.");
      loadDocs();
      loadStats();
      loadCategories();
    } catch (e) { toast.error(formatApiError(e)); }
    setConfirm(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1 inline-flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0D9373]" /> Knowledge Base
          </h1>
          <p className="text-sm text-[#64748B]">Manage documents and categories</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          data-testid="open-kb-upload-btn"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-sm font-medium text-white"
        >
          <Upload className="w-4 h-4" /> Upload .docx
        </button>
        <button
          onClick={() => setShowCategoryPanel((v) => !v)}
          data-testid="toggle-categories-panel"
          className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#E2E8F0] hover:border-[#94A3B8] text-sm font-medium text-[#475569]"
        >
          <Layers className="w-4 h-4" /> Categories ({categories.length})
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5" data-testid="kb-admin-stats">
        <StatCard label="Total docs" value={stats.total_docs} />
        <StatCard label="Published" value={stats.published_docs} accent="#16A34A" />
        <StatCard label="Drafts" value={stats.drafts} accent="#F59E0B" />
        <StatCard label="Featured" value={stats.featured} accent="#0D9373" />
        <StatCard label="Categories" value={stats.total_categories} />
      </div>

      {showCategoryPanel && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg mb-5" data-testid="categories-panel">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="text-sm font-semibold text-[#0A1628] inline-flex items-center gap-2">
              <Layers className="w-4 h-4" /> Categories
            </div>
            <button onClick={() => setCreatingCategory(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-xs font-medium" data-testid="new-category-btn">
              <Plus className="w-3.5 h-3.5" /> New category
            </button>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {categories.map((c) => (
              <div key={c.slug} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC]" data-testid={`category-row-${c.slug}`}>
                <div className="w-9 h-9 rounded-md bg-[#F1F5F9] flex items-center justify-center text-base shrink-0">{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#0F172A] truncate">{c.name}</div>
                  <div className="text-xs text-[#64748B] truncate">{c.description}</div>
                </div>
                <div className="text-xs text-[#64748B] text-right shrink-0">
                  <span className="counter font-medium text-[#0F172A]">{c.doc_count}</span> docs
                </div>
                {c.is_hidden ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">Hidden</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] font-medium">Active</span>
                )}
                <button onClick={() => setEditingCategory(c)} data-testid={`edit-category-${c.slug}`} className="px-2.5 py-1 rounded text-xs border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]">Edit</button>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#94A3B8]">No categories yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by title or summary..."
            data-testid="kb-docs-search"
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-md focus:border-[#0D9373] outline-none text-sm"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm" data-testid="kb-docs-filter-category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-[#E2E8F0]" data-testid="kb-docs-tabs">
        {STATUS_TABS.map((t) => {
          const active = statusFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setStatusFilter(t.id); setPage(1); }}
              data-testid={`kb-tab-${t.id}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? "border-[#0D9373] text-[#0A1628]" : "border-transparent text-[#64748B] hover:text-[#0A1628]"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-x-auto" data-testid="kb-docs-table">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Views</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedDocs.map((g) => {
              const collapsed = collapsedGroups.has(g.key);
              return (
                <React.Fragment key={g.key}>
                  <tr
                    className="bg-[#F1F5F9] border-y border-[#E2E8F0] cursor-pointer hover:bg-[#E9EFF5] select-none"
                    onClick={() => toggleGroup(g.key)}
                    data-testid={`kb-group-${g.key}`}
                  >
                    <td colSpan={7} className="px-4 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />}
                        <span>{g.module}</span>
                        <span className="text-[#94A3B8]">›</span>
                        <span className="text-[#475569]">{g.sub}</span>
                        <span className="ml-2 text-[#94A3B8] font-normal">({g.docs.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!collapsed && g.docs.map((d) => (
                    <tr key={d.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]" data-testid={`kb-row-${d.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[10px] font-bold tracking-wider text-[#0D9373] uppercase mb-1" data-testid={`kb-refid-${d.id}`}>
                          {d.reference_id || "—"}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <DocTypeBadge type={d.doc_type} />
                          <DifficultyBadge level={d.difficulty} />
                          {d.is_featured && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#FEF3C7] text-[#92400E]">
                              <Star className="w-3 h-3 fill-current" /> Featured
                            </span>
                          )}
                        </div>
                        <div className="font-normal text-[#0F172A] leading-snug line-clamp-2">{d.title}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#475569]">{d.category?.icon} {d.category?.name}</td>
                      <td className="px-4 py-3 text-xs text-[#475569]">{d.author?.full_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{timeAgo(d.updated_at)}</td>
                      <td className="px-4 py-3 text-right counter">{d.view_count}</td>
                      <td className="px-4 py-3">
                        {d.is_published ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] font-medium">Published</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-[#FFFBEB] text-[#D97706] font-medium">Draft</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right relative">
                        <button onClick={(e) => {
                          if (openMenuId === d.id) { setOpenMenuId(null); return; }
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
                          setOpenMenuId(d.id);
                        }} className="p-1.5 hover:bg-[#F1F5F9] rounded text-[#64748B]" data-testid={`kb-menu-${d.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === d.id && createPortal(
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setOpenMenuId(null)} />
                            <div style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 70 }} className="w-56 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 text-left">
                              {d.is_published && d.category?.slug && (
                                <a href={`/knowledge-base/${d.category.slug}/${d.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                                  <ExternalLink className="w-3.5 h-3.5" /> View document
                                </a>
                              )}
                              {d.is_published ? (
                                <button onClick={() => patchDoc(d.id, { is_published: false }, "Document unpublished")} data-testid={`kb-unpublish-${d.id}`} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
                                  <EyeOff className="w-3.5 h-3.5" /> Unpublish
                                </button>
                              ) : (
                                <button onClick={() => patchDoc(d.id, { is_published: true }, "Document published")} data-testid={`kb-publish-${d.id}`} className="w-full text-left px-3 py-2 text-sm text-[#16A34A] hover:bg-[#F0FDF4] flex items-center gap-2">
                                  <Eye className="w-3.5 h-3.5" /> Publish now
                                </button>
                              )}
                              {d.is_featured ? (
                                <button onClick={() => patchDoc(d.id, { is_featured: false }, "Removed from featured")} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
                                  <StarOff className="w-3.5 h-3.5" /> Remove featured
                                </button>
                              ) : (
                                <button onClick={() => patchDoc(d.id, { is_featured: true }, "Marked as featured")} data-testid={`kb-feature-${d.id}`} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2">
                                  <Star className="w-3.5 h-3.5" /> Mark as featured
                                </button>
                              )}
                              <div className="border-t border-[#F1F5F9] my-1" />
                              <button onClick={() => { setConfirm({ type: "delete", doc: d }); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2" data-testid={`kb-delete-${d.id}`}>
                                <FileEdit className="w-3.5 h-3.5" /> Delete permanently
                              </button>
                            </div>
                          </>,
                          document.body
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {docs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                <FileText className="w-8 h-8 mx-auto mb-3 text-[#CBD5E1]" />
                No documents match these filters.
                <Link to="/knowledge-base/new" className="block mt-3 text-[#0D9373] hover:underline">Contribute the first one →</Link>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm">
          <span className="text-[#64748B]">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded border border-[#E2E8F0] disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded border border-[#E2E8F0] disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirm?.type === "delete"}
        title={`Delete "${(confirm?.doc?.title || "").slice(0, 60)}..."?`}
        message="This permanently removes the document and all helpful-vote history. This cannot be undone."
        confirmLabel="Permanently delete" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteDoc(confirm.doc.id)}
      />

      {(editingCategory || creatingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => { setEditingCategory(null); setCreatingCategory(false); }}
          onSaved={() => { setEditingCategory(null); setCreatingCategory(false); loadCategories(); loadStats(); }}
        />
      )}

      {showUploadModal && (
        <KBDocxUploadModal
          onClose={() => setShowUploadModal(false)}
          onSaved={() => { setShowUploadModal(false); loadDocs(); loadStats(); }}
        />
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, accent = "#0A1628" }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium">{label}</div>
      <div className="font-heading text-2xl font-bold mt-1.5 counter" style={{ color: accent }}>{value ?? "—"}</div>
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [description, setDescription] = useState(category?.description || "");
  const [icon, setIcon] = useState(category?.icon || "📚");
  const [isHidden, setIsHidden] = useState(!!category?.is_hidden);
  const isEdit = !!category;

  const onNameChange = (val) => {
    setName(val);
    if (!isEdit && !slugTouched) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
  };

  const save = async () => {
    try {
      if (isEdit) {
        await api.patch(`/admin/kb/categories/${category.slug}`, {
          name, description, icon, is_hidden: isHidden,
        });
        toast.success("Category updated.");
      } else {
        await api.post("/admin/kb/categories", { slug, name, description, icon });
        toast.success("Category created.");
      }
      onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="kb-category-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-semibold text-lg text-[#0A1628]">{isEdit ? `Edit ${category.name}` : "Create new category"}</h3>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[#475569]">Name</label>
            <input value={name} onChange={(e) => onNameChange(e.target.value)} data-testid="cat-name-input" className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm" />
          </div>
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-[#475569]">Slug</label>
              <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} data-testid="cat-slug-input" className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm font-mono" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-[#475569]">Icon (emoji)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} data-testid="cat-icon-input" className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm" placeholder="📚" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#475569]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="cat-desc-input" className="mt-1.5 w-full min-h-[70px] px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-[#475569]">
              <input type="checkbox" checked={isHidden} onChange={(e) => setIsHidden(e.target.checked)} data-testid="cat-hidden-toggle" />
              Hide this category from members
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
          <button onClick={save} disabled={!name || !slug} data-testid="cat-save-btn" className="px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50">
            {isEdit ? "Save changes" : "Create category"}
          </button>
        </div>
      </div>
    </div>
  );
}

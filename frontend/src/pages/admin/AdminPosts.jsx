import React, { useEffect, useState, useCallback } from "react";
import { MoreVertical, Search as SearchIcon, ExternalLink, Pin, EyeOff } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import GroupBadge from "../../components/GroupBadge";
import ConfirmModal from "../../components/ConfirmModal";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { toast } from "sonner";

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    api.get("/admin/spaces").then((r) => setSpaces(r.data));
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, page_size: 25 });
    if (q) params.set("q", q);
    if (type !== "all") params.set("type", type);
    if (spaceFilter !== "all") params.set("space", spaceFilter);
    if (status !== "all") params.set("status", status);
    api.get(`/admin/posts?${params}`)
      .then((r) => { setPosts(r.data.posts); setTotal(r.data.total); })
      .catch(() => {});
  }, [q, type, spaceFilter, status, page]);

  useEffect(load, [load]);

  const patchPost = async (postId, updates, successMsg) => {
    try {
      await api.patch(`/admin/posts/${postId}`, updates);
      toast.success(successMsg);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setOpenMenuId(null);
    setConfirm(null);
  };
  const deletePost = async (postId) => {
    try { await api.delete(`/admin/posts/${postId}`); toast.success("Post deleted."); load(); }
    catch (e) { toast.error(formatApiError(e)); }
    setConfirm(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <AdminLayout>
      <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Posts</h1>
      <p className="text-sm text-[#64748B] mb-5">Moderate community content ({total} total)</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search titles..." data-testid="posts-search"
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-md focus:border-[#0D9373] outline-none text-sm" />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm">
          <option value="all">All types</option>
          <option value="question">Question</option>
          <option value="discussion">Discussion</option>
          <option value="success_story">Success Story</option>
        </select>
        <select value={spaceFilter} onChange={(e) => { setSpaceFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm">
          <option value="all">All spaces</option>
          {spaces.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="pinned">Pinned</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-x-auto" data-testid="posts-table">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Space</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium">Posted</th>
              <th className="px-4 py-3 font-medium text-right">Votes</th>
              <th className="px-4 py-3 font-medium text-right">Answers</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]" data-testid={`post-row-${p.id}`}>
                <td className="px-4 py-3 max-w-[300px]">
                  <a href={`/community/posts/${p.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0F172A] hover:text-[#0D9373] line-clamp-1">
                    {p.is_pinned && <Pin className="inline w-3 h-3 mr-1 text-[#0D9373]" />}
                    {p.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{p.type.replace("_", " ")}</td>
                <td className="px-4 py-3 text-xs text-[#0D9373]">{p.space?.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{p.author?.full_name}</span>
                    <GroupBadge group={p.author?.group_type} />
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{timeAgo(p.created_at)}</td>
                <td className="px-4 py-3 text-right counter">{p.vote_count}</td>
                <td className="px-4 py-3 text-right counter">{p.answer_count}</td>
                <td className="px-4 py-3">
                  {p.is_removed ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626] font-medium">Removed</span>
                  ) : p.is_pinned ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#0D9373]/10 text-[#0D9373] font-medium">Pinned</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right relative">
                  <button onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)} className="p-1.5 hover:bg-[#F1F5F9] rounded text-[#64748B]" data-testid={`post-menu-${p.id}`}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === p.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-4 top-10 z-40 w-48 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 text-left">
                        <a href={`/community/posts/${p.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                          <ExternalLink className="w-3.5 h-3.5" /> View post
                        </a>
                        {p.is_pinned ? (
                          <button onClick={() => patchPost(p.id, { is_pinned: false }, "Unpinned")} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">Unpin</button>
                        ) : (
                          <button onClick={() => patchPost(p.id, { is_pinned: true }, "Post pinned")} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                            <Pin className="inline w-3.5 h-3.5 mr-1" />Pin
                          </button>
                        )}
                        {p.is_removed ? (
                          <button onClick={() => patchPost(p.id, { is_removed: false }, "Restored")} className="w-full text-left px-3 py-2 text-sm text-[#16A34A] hover:bg-[#F0FDF4]">Restore</button>
                        ) : (
                          <button onClick={() => setConfirm({ type: "remove", post: p })} className="w-full text-left px-3 py-2 text-sm text-[#D97706] hover:bg-[#FFFBEB]">
                            <EyeOff className="inline w-3.5 h-3.5 mr-1" /> Remove
                          </button>
                        )}
                        <button onClick={() => setConfirm({ type: "delete", post: p })} className="w-full text-left px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2]">Delete permanently</button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {posts.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#94A3B8]">No posts match these filters.</td></tr>}
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
        open={confirm?.type === "remove"}
        title="Remove this post?"
        message="Removed posts are hidden from the community but stay in the database, so you can restore them later."
        confirmLabel="Remove from community" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => patchPost(confirm.post.id, { is_removed: true }, "Post removed")}
      />
      <ConfirmModal
        open={confirm?.type === "delete"}
        title="Permanently delete this post?"
        message="This will delete the post and all its answers, comments, votes, and bookmarks. This cannot be undone."
        confirmLabel="Permanently delete" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => deletePost(confirm.post.id)}
      />
    </AdminLayout>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { MoreVertical, Search as SearchIcon, ExternalLink } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import GroupBadge from "../../components/GroupBadge";
import ConfirmModal from "../../components/ConfirmModal";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const GROUPS = ["aspirant", "practitioner", "employer"];

export default function AdminMembers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [groupModal, setGroupModal] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, page_size: 25 });
    if (q) params.set("q", q);
    if (group !== "all") params.set("group", group);
    if (status !== "all") params.set("status", status);
    api.get(`/admin/members?${params}`)
      .then((r) => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => {});
  }, [q, group, status, page]);

  useEffect(load, [load]);

  const patchUser = async (userId, updates, successMsg) => {
    try {
      await api.patch(`/admin/members/${userId}`, updates);
      toast.success(successMsg);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setOpenMenuId(null);
    setGroupModal(null);
    setConfirm(null);
  };

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/admin/members/${userId}`);
      toast.success("Account deleted.");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setConfirm(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <AdminLayout>
      <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Members</h1>
      <p className="text-sm text-[#64748B] mb-5">Manage the community ({total} total)</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name, username or email..."
            data-testid="members-search"
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-md focus:border-[#0D9373] outline-none text-sm"
          />
        </div>
        <select value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm" data-testid="members-filter-group">
          <option value="all">All groups</option>
          <option value="aspirant">Aspirant</option>
          <option value="practitioner">Practitioner</option>
          <option value="employer">Employer</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm" data-testid="members-filter-status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-x-auto" data-testid="members-table">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Modules</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Rep</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]" data-testid={`member-row-${u.username}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-xs font-medium shrink-0">
                      {(u.full_name || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[#0F172A] truncate flex items-center gap-1.5">
                        {u.full_name}
                        {u.is_admin && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#0D9373]/10 text-[#0D9373] font-semibold">Admin</span>}
                      </div>
                      <div className="text-xs text-[#94A3B8] truncate">@{u.username} · {u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><GroupBadge group={u.group_type} /></td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{(u.workday_modules || []).slice(0, 2).join(", ")}{(u.workday_modules || []).length > 2 ? "..." : ""}</td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{timeAgo(u.created_at)}</td>
                <td className="px-4 py-3 text-right counter font-medium">{u.reputation_score}</td>
                <td className="px-4 py-3">
                  {u.is_suspended ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626] font-medium">Suspended</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right relative">
                  <button onClick={() => setOpenMenuId(openMenuId === u.user_id ? null : u.user_id)} className="p-1.5 hover:bg-[#F1F5F9] rounded text-[#64748B]" data-testid={`member-menu-${u.username}`}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === u.user_id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-4 top-10 z-40 w-52 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 text-left">
                        <a href={`/profile/${u.username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                          <ExternalLink className="w-3.5 h-3.5" /> View profile
                        </a>
                        <button onClick={() => { setGroupModal(u); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">Change group</button>
                        {u.is_suspended ? (
                          <button onClick={() => patchUser(u.user_id, { is_suspended: false }, "Account unsuspended")} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">Unsuspend</button>
                        ) : (
                          <button onClick={() => setConfirm({ type: "suspend", user: u })} className="w-full text-left px-3 py-2 text-sm text-[#D97706] hover:bg-[#FFFBEB]">Suspend account</button>
                        )}
                        {!u.is_admin && (
                          <button onClick={() => patchUser(u.user_id, { is_admin: true }, "Granted admin")} className="w-full text-left px-3 py-2 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">Make admin</button>
                        )}
                        <button onClick={() => setConfirm({ type: "delete", user: u })} className="w-full text-left px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEF2F2]">Delete account</button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#94A3B8]">No members match these filters.</td></tr>
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
        open={confirm?.type === "suspend"}
        title={`Suspend @${confirm?.user?.username}?`}
        message="Suspended users can still log in and read but cannot post, answer, vote, or comment. You can unsuspend them anytime."
        confirmLabel="Suspend account" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => patchUser(confirm.user.user_id, { is_suspended: true }, "Account suspended")}
      />
      <ConfirmModal
        open={confirm?.type === "delete"}
        title={`Delete @${confirm?.user?.username}?`}
        message="This will permanently delete this member and all their posts, answers, votes, and bookmarks. This cannot be undone."
        confirmLabel="Permanently delete" danger
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteUser(confirm.user.user_id)}
      />

      {groupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setGroupModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-semibold text-lg text-[#0A1628]">Change group for @{groupModal.username}</h3>
            <p className="text-sm text-[#64748B] mt-1">Currently: <GroupBadge group={groupModal.group_type} /></p>
            <div className="mt-5 flex flex-col gap-2">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  disabled={g === groupModal.group_type}
                  onClick={() => patchUser(groupModal.user_id, { group_type: g }, `Group changed to ${g}`)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded border text-sm ${g === groupModal.group_type ? "border-[#E2E8F0] opacity-50" : "border-[#E2E8F0] hover:border-[#0D9373]"}`}
                  data-testid={`change-group-${g}`}
                >
                  <GroupBadge group={g} />
                  {g === groupModal.group_type && <span className="text-xs text-[#94A3B8]">Current</span>}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setGroupModal(null)} className="px-4 py-2 text-sm text-[#475569] hover:bg-[#F1F5F9] rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

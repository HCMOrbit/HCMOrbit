import React, { useEffect, useState, useCallback } from "react";
import { Plus, Eye, EyeOff } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

export default function AdminSpaces() {
  const [spaces, setSpaces] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.get("/admin/spaces").then((r) => setSpaces(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const toggleHidden = async (slug, isHidden) => {
    try {
      await api.patch(`/admin/spaces/${slug}`, { is_hidden: !isHidden });
      toast.success(isHidden ? "Space is now visible" : "Space hidden");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Spaces</h1>
          <p className="text-sm text-[#64748B]">Manage topic spaces ({spaces.length})</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium" data-testid="new-space-btn">
          <Plus className="w-4 h-4" /> New space
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-x-auto" data-testid="spaces-table">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium text-right">Posts</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {spaces.map((s) => (
              <tr key={s.slug} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]" data-testid={`space-row-${s.slug}`}>
                <td className="px-4 py-3 font-medium text-[#0F172A]">{s.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#64748B]">{s.slug}</td>
                <td className="px-4 py-3 text-xs text-[#64748B] max-w-[300px] truncate">{s.description}</td>
                <td className="px-4 py-3 text-right counter">{s.post_count}</td>
                <td className="px-4 py-3">
                  {s.is_hidden ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">Hidden</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setEditing(s)} className="px-2.5 py-1 rounded text-xs border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]" data-testid={`edit-space-${s.slug}`}>Edit</button>
                    <button onClick={() => toggleHidden(s.slug, s.is_hidden)} className="px-2.5 py-1 rounded text-xs border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569] inline-flex items-center gap-1" data-testid={`toggle-space-${s.slug}`}>
                      {s.is_hidden ? <><Eye className="w-3 h-3" /> Show</> : <><EyeOff className="w-3 h-3" /> Hide</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <SpaceModal
          space={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </AdminLayout>
  );
}

function SpaceModal({ space, onClose, onSaved }) {
  const [name, setName] = useState(space?.name || "");
  const [slug, setSlug] = useState(space?.slug || "");
  const [description, setDescription] = useState(space?.description || "");
  const [icon, setIcon] = useState(space?.icon || "Hash");
  const isEdit = !!space;

  useEffect(() => {
    if (!isEdit && name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
    // eslint-disable-next-line
  }, [name]);

  const save = async () => {
    try {
      if (isEdit) {
        await api.patch(`/admin/spaces/${space.slug}`, { name, description, icon });
        toast.success("Space updated.");
      } else {
        await api.post("/admin/spaces", { slug, name, description, icon });
        toast.success("Space created.");
      }
      onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="space-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-semibold text-lg text-[#0A1628]">{isEdit ? `Edit ${space.name}` : "Create a new space"}</h3>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[#475569]">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm" data-testid="space-name-input" />
          </div>
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-[#475569]">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm font-mono" data-testid="space-slug-input" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-[#475569]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 w-full min-h-[80px] px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm" data-testid="space-desc-input" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#475569]">Icon (Lucide name or emoji)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded border border-[#E2E8F0] outline-none focus:border-[#0D9373] text-sm font-mono" placeholder="Hash" data-testid="space-icon-input" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
          <button onClick={save} disabled={!name || !slug} className="px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50" data-testid="space-save-btn">
            {isEdit ? "Save changes" : "Create space"}
          </button>
        </div>
      </div>
    </div>
  );
}

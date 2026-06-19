import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Award } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const STATUSES = ["New", "Upcoming", "Released"];

const EMPTY = {
  name: "",
  status: "New",
  date_label: "",
  is_published: true,
};

const inputCls = "w-full px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9373]/30 focus:border-[#0D9373] bg-white";

export default function AdminEcosystemCertifications() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ecosystem/certifications");
      setCerts(data.items || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit   = (c) => { setForm({ ...EMPTY, ...c }); setEditing(c.id); };
  const closeForm  = () => { setEditing(null); setForm(EMPTY); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/admin/ecosystem/certifications", form);
        toast.success("Certification created");
      } else {
        await api.patch(`/admin/ecosystem/certifications/${editing}`, form);
        toast.success("Certification updated");
      }
      closeForm();
      refresh();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const removeCert = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/ecosystem/certifications/${c.id}`);
      toast.success("Certification deleted");
      refresh();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Certification watch</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage certifications shown on the public <strong>/ecosystem</strong> page.</p>
        </div>
        <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium"
                data-testid="cert-create-btn">
          <Plus className="w-4 h-4" /> New certification
        </button>
      </div>

      {editing && (
        <form onSubmit={save}
              className="bg-white border border-[#0D9373]/30 rounded-lg p-5 mb-6 shadow-sm"
              data-testid="cert-form">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-base font-semibold text-[#0A1628]">
              {editing === "new" ? "New certification" : "Edit certification"}
            </h2>
            <button type="button" onClick={closeForm} className="text-[#94A3B8] hover:text-[#0A1628]" data-testid="cert-form-close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">Name *</label>
              <input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}
                     className={inputCls} data-testid="cert-form-name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">Status *</label>
              <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}
                      className={inputCls} data-testid="cert-form-status">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">Date label (e.g. &quot;July 2026&quot;)</label>
              <input value={form.date_label} onChange={(e)=>setForm({...form,date_label:e.target.value})}
                     className={inputCls} data-testid="cert-form-date-label" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
                <input type="checkbox" checked={form.is_published}
                       onChange={(e)=>setForm({...form,is_published:e.target.checked})}
                       data-testid="cert-form-published" />
                Visible on the public /ecosystem page
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeForm}
                    className="px-4 py-2 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium disabled:opacity-60"
                    data-testid="cert-form-submit">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : (editing === "new" ? "Create" : "Save changes")}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#64748B]">Loading…</div>
        ) : certs.length === 0 ? (
          <div className="p-6 text-sm text-[#94A3B8] flex items-center gap-2"><Award className="w-4 h-4" /> No certifications yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Date label</th>
                <th className="px-4 py-2.5 font-semibold">Visibility</th>
                <th className="px-4 py-2.5 font-semibold w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`cert-row-${c.id}`}>
                  <td className="px-4 py-3 text-[#0A1628]">{c.name}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-[#0D9373] uppercase tracking-wider">{c.status}</span></td>
                  <td className="px-4 py-3 text-[#64748B]">{c.date_label || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      c.is_published ? "bg-[#E1F5EE] text-[#0A7B59]" : "bg-[#F1F5F9] text-[#94A3B8]"
                    }`}>
                      {c.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={()=>openEdit(c)} className="p-1.5 rounded hover:bg-[#E2E8F0]" title="Edit" data-testid={`cert-edit-${c.id}`}>
                        <Pencil className="w-3.5 h-3.5 text-[#475569]" />
                      </button>
                      <button onClick={()=>removeCert(c)} className="p-1.5 rounded hover:bg-[#FEE2E2]" title="Delete" data-testid={`cert-delete-${c.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}

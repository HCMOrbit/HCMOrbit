import React, { useEffect, useState } from "react";
import { Plus, Award } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { ecoInputCls, EcoFormField, EcoFormShell, EcoRowActions, EcoStatusPill } from "../../components/admin/EcoPrimitives";

const STATUSES = ["New", "Upcoming", "Released"];
const EMPTY = { name: "", status: "New", date_label: "", is_published: true };

export default function CertificationsPanel() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { const { data } = await api.get("/admin/ecosystem/certifications"); setCerts(data.items || []); }
    catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit   = (c) => { setForm({ ...EMPTY, ...c }); setEditing(c.id); };
  const closeForm  = () => { setEditing(null); setForm(EMPTY); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") { await api.post("/admin/ecosystem/certifications", form); toast.success("Certification created"); }
      else { await api.patch(`/admin/ecosystem/certifications/${editing}`, form); toast.success("Certification updated"); }
      closeForm(); refresh();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const removeCert = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/ecosystem/certifications/${c.id}`); toast.success("Certification deleted"); refresh(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <p className="text-sm text-[#64748B]">Certifications shown on the public <strong>/ecosystem</strong> page.</p>
        <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium"
                data-testid="cert-create-btn">
          <Plus className="w-4 h-4" /> New certification
        </button>
      </div>

      {editing && (
        <EcoFormShell
          title={editing === "new" ? "New certification" : "Edit certification"}
          onClose={closeForm} onSubmit={save} saving={saving}
          submitLabel={editing === "new" ? "Create" : "Save changes"} testIdPrefix="cert"
        >
          <EcoFormField label="Name *" wide>
            <input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className={ecoInputCls} data-testid="cert-form-name" />
          </EcoFormField>
          <EcoFormField label="Status *">
            <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className={ecoInputCls} data-testid="cert-form-status">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </EcoFormField>
          <EcoFormField label='Date label (e.g. "July 2026")'>
            <input value={form.date_label} onChange={(e)=>setForm({...form,date_label:e.target.value})} className={ecoInputCls} data-testid="cert-form-date-label" placeholder="Optional" />
          </EcoFormField>
          <EcoFormField label="Published" wide>
            <label className="inline-flex items-center gap-2 text-sm text-[#475569]">
              <input type="checkbox" checked={form.is_published} onChange={(e)=>setForm({...form,is_published:e.target.checked})} data-testid="cert-form-published" />
              Visible on the public /ecosystem page
            </label>
          </EcoFormField>
        </EcoFormShell>
      )}

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#64748B]">Loading…</div>
        ) : certs.length === 0 ? (
          <div className="p-6 text-sm text-[#94A3B8] flex items-center gap-2"><Award className="w-4 h-4" /> No certifications yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#E2E8F0]">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Date label</th>
              <th className="px-4 py-2.5 font-semibold">Visibility</th>
              <th className="px-4 py-2.5 font-semibold w-32 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`cert-row-${c.id}`}>
                  <td className="px-4 py-3 text-[#0A1628]">{c.name}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-[#0D9373] uppercase tracking-wider">{c.status}</span></td>
                  <td className="px-4 py-3 text-[#64748B]">{c.date_label || "—"}</td>
                  <td className="px-4 py-3"><EcoStatusPill isPublished={c.is_published} /></td>
                  <td className="px-4 py-3 text-right">
                    <EcoRowActions testIdPrefix="cert" id={c.id} onEdit={()=>openEdit(c)} onDelete={()=>removeCert(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

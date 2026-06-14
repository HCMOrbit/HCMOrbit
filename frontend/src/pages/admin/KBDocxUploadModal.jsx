import React, { useState, useRef } from "react";
import { Upload, X, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

/**
 * KBDocxUploadModal — two-step admin flow:
 *   1. Drag-and-drop / pick a .docx file → POST /api/admin/kb/docs/upload (parses, does not persist)
 *   2. Review screen with every parsed field editable, flags surfaced inline,
 *      "Save as draft" button posts to POST /api/kb/docs with publish:false.
 */
export default function KBDocxUploadModal({ onClose, onSaved }) {
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Please choose a .docx file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is larger than 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/kb/docs/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setParsed(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setUploading(false);
    }
  };

  const update = (key, value) => setParsed((p) => ({ ...p, [key]: value }));

  const saveAsDraft = async () => {
    if (!parsed) return;
    if (!parsed.title || parsed.title.length < 10) { toast.error("Title must be at least 10 characters."); return; }
    if (!parsed.summary || parsed.summary.length < 30) { toast.error("Summary must be at least 30 characters."); return; }
    if (!parsed.category_slug) { toast.error("Pick a category."); return; }
    setSaving(true);
    try {
      const payload = {
        title: parsed.title.trim(),
        summary: parsed.summary.trim(),
        body: parsed.body,
        category_slug: parsed.category_slug,
        doc_type: parsed.doc_type,
        difficulty: parsed.difficulty,
        target_groups: parsed.target_groups || ["aspirant", "practitioner", "employer"],
        tags: (parsed.tags || []).map((t) => t.toString().trim().toLowerCase()).filter(Boolean),
        reference_id: parsed.reference_id || null,
        sub_module: parsed.sub_module || null,
        read_time: parsed.read_time || null,
        platform: parsed.platform || "Workday",
        publish: false,
      };
      await api.post("/kb/docs", payload);
      toast.success("Saved as draft. Open the row to publish when ready.");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" data-testid="kb-upload-modal">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-heading font-semibold text-lg text-[#0A1628] inline-flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0D9373]" /> Upload Knowledge Base document
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#F1F5F9]" data-testid="kb-upload-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!parsed ? (
          <div className="p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${dragOver ? "border-[#0D9373] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}
              data-testid="kb-upload-dropzone"
            >
              <FileText className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <div className="font-heading font-semibold text-[#0A1628]">Drag a .docx file here</div>
              <div className="text-sm text-[#64748B] mt-1">or</div>
              <button
                type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                data-testid="kb-upload-pick-btn"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium disabled:opacity-50"
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : "Choose file"}
              </button>
              <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => handleFiles(e.target.files)} data-testid="kb-upload-file-input" />
              <div className="text-xs text-[#94A3B8] mt-4 max-w-md mx-auto leading-relaxed">
                Expects the first table in the document to be the 11-row metadata block (Document ID, Title, Module, etc.). Everything after the table is parsed as Markdown.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4" data-testid="kb-upload-review">
            {parsed.flags && parsed.flags.length > 0 && (
              <div className="rounded-md border border-[#F59E0B]/40 bg-[#FFFBEB] p-4" data-testid="kb-upload-flags">
                <div className="flex items-center gap-2 text-[#92400E] font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" /> Please confirm:
                </div>
                <ul className="mt-2 list-disc pl-6 text-sm text-[#78350F] space-y-1">
                  {parsed.flags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title *">
                <input value={parsed.title || ""} onChange={(e) => update("title", e.target.value)} data-testid="kb-upload-title" className="kb-upl-input" />
              </Field>
              <Field label="Reference ID">
                <input value={parsed.reference_id || ""} onChange={(e) => update("reference_id", e.target.value)} data-testid="kb-upload-ref" className="kb-upl-input font-mono" />
              </Field>
              <Field label="Category *" hint={parsed.category_label_raw ? `from doc: "${parsed.category_label_raw}"` : ""}>
                <select value={parsed.category_slug} onChange={(e) => update("category_slug", e.target.value)} data-testid="kb-upload-category" className="kb-upl-input">
                  <option value="">Select category…</option>
                  {(parsed.available_categories || []).map((c) => (
                    <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Doc type *" hint={parsed.doc_type_label_raw ? `from doc: "${parsed.doc_type_label_raw}"` : ""}>
                <select value={parsed.doc_type} onChange={(e) => update("doc_type", e.target.value)} data-testid="kb-upload-doctype" className="kb-upl-input">
                  {(parsed.available_doc_types || []).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Difficulty">
                <select value={parsed.difficulty} onChange={(e) => update("difficulty", e.target.value)} data-testid="kb-upload-difficulty" className="kb-upl-input capitalize">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>
              <Field label="Estimated read time">
                <input value={parsed.read_time || ""} onChange={(e) => update("read_time", e.target.value)} placeholder="e.g. 25-30 min" data-testid="kb-upload-readtime" className="kb-upl-input" />
              </Field>
              <Field label="Sub-module">
                <input value={parsed.sub_module || ""} onChange={(e) => update("sub_module", e.target.value)} data-testid="kb-upload-submodule" className="kb-upl-input" />
              </Field>
              <Field label="Platform">
                <input value={parsed.platform || "Workday"} onChange={(e) => update("platform", e.target.value)} data-testid="kb-upload-platform" className="kb-upl-input" />
              </Field>
            </div>

            <Field label="Tags" hint="comma separated">
              <input
                value={(parsed.tags || []).join(", ")}
                onChange={(e) => update("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                data-testid="kb-upload-tags"
                className="kb-upl-input font-mono"
              />
            </Field>

            <Field label="Summary *" hint={`${(parsed.summary || "").length}/280`}>
              <textarea
                value={parsed.summary || ""} maxLength={280}
                onChange={(e) => update("summary", e.target.value)}
                data-testid="kb-upload-summary"
                className="kb-upl-input min-h-[70px]"
              />
            </Field>

            <Field label="Body (Markdown)" hint={`${parsed.body.length} chars`}>
              <textarea
                value={parsed.body}
                onChange={(e) => update("body", e.target.value)}
                data-testid="kb-upload-body"
                className="kb-upl-input min-h-[260px] font-mono text-xs leading-relaxed"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <button onClick={() => setParsed(null)} className="px-4 py-2 rounded text-sm text-[#475569] hover:bg-[#F1F5F9]" data-testid="kb-upload-back">
                Choose a different file
              </button>
              <button
                onClick={saveAsDraft} disabled={saving}
                data-testid="kb-upload-save-draft"
                className="px-5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save as draft"}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .kb-upl-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          outline: none;
        }
        .kb-upl-input:focus { border-color: #0D9373; box-shadow: 0 0 0 2px rgba(13, 147, 115, 0.2); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-[#475569]">{label}</label>
        {hint && <span className="text-[11px] text-[#94A3B8]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

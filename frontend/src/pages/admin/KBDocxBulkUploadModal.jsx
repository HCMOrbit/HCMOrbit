import React, { useState, useRef, useMemo } from "react";
import { Upload, X, FileText, Loader2, CheckCircle2, XCircle, MinusCircle, Layers } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { toast } from "sonner";

/**
 * KBDocxBulkUploadModal — admin sequential bulk upload of `.docx` KB documents.
 *
 * Pipeline per file (reuses single-file endpoints, no new backend):
 *   1. POST /api/admin/kb/docs/upload  → parses + returns metadata + duplicate flag
 *   2. If duplicate.existing_id  → mark 'Already exists' (skipped)
 *   3. Validate min fields (title ≥10, summary ≥30, body ≥100, category_slug)
 *   4. POST /api/kb/docs  with publish:true → mark success
 *
 * Files are processed strictly sequentially to keep memory/network predictable.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const STATE_LABELS = {
  pending:    { label: "Pending",       color: "text-[#94A3B8]" },
  processing: { label: "Processing…",   color: "text-[#0D9373]" },
  success:    { label: "Uploaded",      color: "text-[#16A34A]" },
  skipped:    { label: "Already exists", color: "text-[#D97706]" },
  failed:     { label: "Failed",        color: "text-[#DC2626]" },
};

function StateIcon({ state }) {
  if (state === "processing") return <Loader2 className="w-4 h-4 animate-spin text-[#0D9373]" />;
  if (state === "success")    return <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />;
  if (state === "skipped")    return <MinusCircle className="w-4 h-4 text-[#D97706]" />;
  if (state === "failed")     return <XCircle className="w-4 h-4 text-[#DC2626]" />;
  return <FileText className="w-4 h-4 text-[#94A3B8]" />;
}

export default function KBDocxBulkUploadModal({ onClose, onSaved }) {
  const [files, setFiles] = useState([]); // File[]
  const [statuses, setStatuses] = useState([]); // [{state, message}]
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const fileRef = useRef(null);

  const onFilesPicked = (picked) => {
    if (!picked?.length) return;
    const filtered = [];
    const rejected = [];
    for (const f of Array.from(picked)) {
      if (!f.name.toLowerCase().endsWith(".docx")) { rejected.push(`${f.name} (not .docx)`); continue; }
      if (f.size > MAX_FILE_BYTES)                  { rejected.push(`${f.name} (>10MB)`);    continue; }
      filtered.push(f);
    }
    if (rejected.length) toast.error(`Skipped: ${rejected.join(", ")}`);
    setFiles(filtered);
    setStatuses(filtered.map(() => ({ state: "pending", message: "" })));
    setDone(false);
    setCurrentIdx(-1);
  };

  const updateStatus = (idx, patch) => {
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const validateParsed = (parsed) => {
    if (!parsed?.title || parsed.title.trim().length < 10) return "Title must be ≥10 chars";
    if (!parsed?.summary || parsed.summary.trim().length < 30) return "Summary must be ≥30 chars";
    if (!parsed?.body || parsed.body.trim().length < 100) return "Body must be ≥100 chars";
    if (!parsed?.category_slug) return "Category could not be matched";
    return null;
  };

  const processOne = async (file, idx) => {
    updateStatus(idx, { state: "processing", message: "" });
    // Step 1 — parse
    let parsed;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/admin/kb/docs/upload", fd);
      parsed = r.data;
    } catch (e) {
      updateStatus(idx, { state: "failed", message: formatApiError(e) });
      return;
    }
    // Step 2 — duplicate?
    if (parsed?.duplicate?.existing_id) {
      updateStatus(idx, {
        state: "skipped",
        message: `Reference ID "${parsed.reference_id}" already exists`,
      });
      return;
    }
    // Step 3 — validate min fields
    const validationErr = validateParsed(parsed);
    if (validationErr) {
      updateStatus(idx, { state: "failed", message: validationErr });
      return;
    }
    // Step 4 — persist (publish immediately per spec)
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
        publish: true,
      };
      await api.post("/kb/docs", payload);
      updateStatus(idx, { state: "success", message: parsed.title });
    } catch (e) {
      updateStatus(idx, { state: "failed", message: formatApiError(e) });
    }
  };

  const start = async () => {
    if (!files.length || running) return;
    setRunning(true);
    setDone(false);
    for (let i = 0; i < files.length; i++) {
      setCurrentIdx(i);
      await processOne(files[i], i);
    }
    setCurrentIdx(-1);
    setRunning(false);
    setDone(true);
    onSaved?.(); // refresh KB list/stats in parent
  };

  const reset = () => {
    setFiles([]);
    setStatuses([]);
    setDone(false);
    setCurrentIdx(-1);
    if (fileRef.current) fileRef.current.value = "";
  };

  const summary = useMemo(() => ({
    success: statuses.filter((s) => s.state === "success").length,
    skipped: statuses.filter((s) => s.state === "skipped").length,
    failed:  statuses.filter((s) => s.state === "failed").length,
  }), [statuses]);

  const totalCount = files.length;
  const processedCount = statuses.filter((s) => s.state !== "pending" && s.state !== "processing").length;
  const currentFileName = currentIdx >= 0 && currentIdx < files.length ? files[currentIdx].name : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" data-testid="kb-bulk-upload-modal">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-heading font-semibold text-lg text-[#0A1628] inline-flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0D9373]" /> Bulk upload Knowledge Base documents
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#F1F5F9]" data-testid="kb-bulk-close" disabled={running}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File picker (visible until files chosen) */}
        {files.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] rounded-lg p-10 text-center">
              <Upload className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <div className="font-heading font-semibold text-[#0A1628]">Select multiple .docx files</div>
              <p className="text-sm text-[#64748B] mt-1">Hold ⌘/Ctrl or Shift to pick several at once.</p>
              <button
                type="button" onClick={() => fileRef.current?.click()}
                data-testid="kb-bulk-pick-btn"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium"
              >
                Choose files
              </button>
              <input
                ref={fileRef} type="file" accept=".docx" multiple className="hidden"
                data-testid="kb-bulk-file-input"
                onChange={(e) => onFilesPicked(e.target.files)}
              />
              <p className="text-xs text-[#94A3B8] mt-4 max-w-md mx-auto leading-relaxed">
                Each file goes through the same DOCX parser as single-file upload.
                Documents with a Reference ID already in the database will be skipped automatically.
                All successfully parsed documents are <strong>published immediately</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4" data-testid="kb-bulk-review">
            {/* Progress strip */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium text-[#0A1628]" data-testid="kb-bulk-progress-label">
                  {!running && !done && <>{totalCount} file{totalCount === 1 ? "" : "s"} ready to upload</>}
                  {running && currentFileName && <>{currentIdx + 1} of {totalCount} — <span className="font-mono">{currentFileName}</span></>}
                  {done && <>All done. Processed {processedCount} of {totalCount} files.</>}
                </div>
                {!running && (done || processedCount === 0) && (
                  <button
                    onClick={reset}
                    data-testid="kb-bulk-reset"
                    className="text-xs font-semibold text-[#0D9373] hover:text-[#0b7c61]"
                  >
                    Clear list
                  </button>
                )}
              </div>
              {totalCount > 0 && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#0D9373] transition-all duration-300"
                    style={{ width: `${(processedCount / totalCount) * 100}%` }}
                    data-testid="kb-bulk-progress-bar"
                  />
                </div>
              )}
              {done && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" data-testid="kb-bulk-summary">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {summary.success} uploaded
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#92400E] font-semibold">
                    <MinusCircle className="w-3.5 h-3.5" /> {summary.skipped} skipped
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#B91C1C] font-semibold">
                    <XCircle className="w-3.5 h-3.5" /> {summary.failed} failed
                  </span>
                </div>
              )}
            </div>

            {/* Per-file rows */}
            <div className="border border-[#E2E8F0] rounded-md divide-y divide-[#F1F5F9] max-h-[420px] overflow-y-auto" data-testid="kb-bulk-files-list">
              {files.map((f, i) => {
                const s = statuses[i] || { state: "pending", message: "" };
                const meta = STATE_LABELS[s.state];
                return (
                  <div key={`${f.name}-${i}`} className="flex items-start gap-3 px-4 py-3 text-sm" data-testid={`kb-bulk-row-${i}`}>
                    <div className="pt-0.5 shrink-0"><StateIcon state={s.state} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[13px] text-[#0F172A] truncate" title={f.name}>{f.name}</div>
                      {s.message && (
                        <div className={`text-xs mt-0.5 ${meta.color}`} data-testid={`kb-bulk-row-${i}-msg`}>
                          {s.message}
                        </div>
                      )}
                    </div>
                    <div className={`shrink-0 text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              {!done ? (
                <>
                  <button
                    onClick={onClose} disabled={running}
                    data-testid="kb-bulk-cancel"
                    className="px-4 py-2 rounded text-sm border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={start} disabled={running || !files.length}
                    data-testid="kb-bulk-start"
                    className="px-5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload all ({totalCount})</>}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  data-testid="kb-bulk-done"
                  className="px-5 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

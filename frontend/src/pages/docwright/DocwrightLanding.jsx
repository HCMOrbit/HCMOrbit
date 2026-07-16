import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Upload, Loader2, History, ClipboardEdit } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import PageHero from "../../components/PageHero";
import AuthPrompt from "../../components/AuthPrompt";
import { useAuth } from "../../lib/auth";
import { api, formatApiError } from "../../lib/api";
import { useDocwrightConfig } from "./shared";

/**
 * Docwright landing + input page.
 *
 * Signed-out users see the full form; hitting "Generate document" swaps
 * the primary CTA for the shared AuthPrompt (per spec).
 */
export default function DocwrightLanding() {
  const { user } = useAuth();
  const { modules, doc_types: docTypes, phases } = useDocwrightConfig();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [tab, setTab] = useState("paste");
  const [clientName, setClientName] = useState("");
  const [module, setModule] = useState(modules[0] || "Core HCM");
  const [docType, setDocType] = useState(docTypes[0] || "Configuration Design Document");
  const [phase, setPhase] = useState(phases[0] || "Architect");
  const [notes, setNotes] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setUploading(true); setUploadName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/docwright/parse-file", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNotes(data.text || "");
      setTab("paste"); // show the extracted text so the user can review
    } catch (err) {
      setError(formatApiError(err));
      setUploadName("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canSubmit = !!clientName.trim() && !!notes.trim() && !submitting;

  const onGenerate = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const { data } = await api.post("/docwright/generate", {
        client_name: clientName.trim(),
        module,
        doc_type: docType,
        phase,
        raw_notes: notes,
      });
      navigate(`/docwright/result/${data.id}`);
    } catch (err) {
      setError(formatApiError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="docwright-landing">
      <NavHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <PageHero
          eyebrow="Docwright"
          title="Turn your config notes into a client-ready design document."
          subtitle="Paste raw notes or upload a file. Docwright produces a formatted Configuration Design Document you can hand to the client."
        />

        {/* Metadata form + input tabs */}
        <div className="mt-8 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client name">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                data-testid="docwright-client-name"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md focus:outline-none focus:border-[#0D9373]"
              />
            </Field>
            <Field label="Workday module">
              <Select value={module} onChange={setModule} options={modules} testid="docwright-module" />
            </Field>
            <Field label="Document type">
              <Select value={docType} onChange={setDocType} options={docTypes} testid="docwright-doc-type" />
            </Field>
            <Field label="Phase">
              <Select value={phase} onChange={setPhase} options={phases} testid="docwright-phase" />
            </Field>
          </div>

          {/* Input tabs */}
          <div className="px-5 sm:px-6 pt-4 flex items-center gap-2 border-b border-[#F1F5F9]" data-testid="docwright-input-tabs">
            <TabButton active={tab === "paste"} onClick={() => setTab("paste")} icon={<ClipboardEdit className="w-4 h-4" />} label="Paste notes" testid="docwright-tab-paste" />
            <TabButton active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="w-4 h-4" />} label="Upload file" testid="docwright-tab-upload" />
          </div>

          <div className="p-5 sm:p-6">
            {tab === "paste" ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your working notes, decisions, tenant values, and constraints here…"
                rows={14}
                data-testid="docwright-notes-textarea"
                className="w-full px-3 py-3 text-sm border border-[#E2E8F0] rounded-md focus:outline-none focus:border-[#0D9373] resize-y font-mono leading-relaxed"
              />
            ) : (
              <div className="border border-dashed border-[#CBD5E1] rounded-md p-8 text-center bg-[#F8FAFC]" data-testid="docwright-upload-drop">
                <FileText className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <p className="text-sm text-[#475569] mb-3">Upload a .docx, .txt, or .md file to extract the notes.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.txt,.md,.text,.markdown"
                  onChange={onFilePicked}
                  className="hidden"
                  data-testid="docwright-file-input"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold disabled:opacity-60"
                  data-testid="docwright-upload-button"
                >
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</> : "Choose file"}
                </button>
                {uploadName && !uploading && (
                  <p className="mt-3 text-xs text-[#0D9373]" data-testid="docwright-upload-name">
                    Extracted from: <span className="font-mono">{uploadName}</span> — review the text on the Paste tab, then Generate.
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-[#94A3B8]">
              Your notes are processed to generate the document and are not used for training.
            </p>
            {error && (
              <div className="mt-3 text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded px-3 py-2" data-testid="docwright-error">
                {error}
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <div className="px-5 sm:px-6 py-4 bg-[#F8FAFC] border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/docwright/history")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0A1628]"
                  data-testid="docwright-history-link"
                >
                  <History className="w-3.5 h-3.5" /> View past documents
                </button>
                <button
                  type="submit"
                  onClick={onGenerate}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="docwright-generate-button"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating (up to ~30s)…</> : "Generate document"}
                </button>
              </>
            ) : (
              <div className="w-full" data-testid="docwright-auth-gate">
                <AuthPrompt message="Sign in to generate your first design document" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, testid }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:border-[#0D9373]"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function TabButton({ active, onClick, icon, label, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active ? "border-[#0D9373] text-[#0A1628]" : "border-transparent text-[#64748B] hover:text-[#0A1628]"
      }`}
    >
      {icon}{label}
    </button>
  );
}

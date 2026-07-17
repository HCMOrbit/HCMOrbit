import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileDown, Copy, Loader2, RefreshCw, ArrowLeft, CheckCircle2, Edit3 } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import { api, formatApiError } from "../../lib/api";
import { SECTION_ORDER } from "./shared";

/**
 * Docwright — result page.
 * Left sidebar: sticky section index with anchor links.
 * Body: each section rendered as markdown, inline-editable in place.
 * Top bar: Download .docx / .pdf / Copy as Markdown.
 */
export default function DocwrightResult() {
  const { docId } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [regenKey, setRegenKey] = useState(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/docwright/documents/${docId}`);
        if (!cancelled) setDoc(data);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  const sectionsMd = useMemo(() => {
    if (!doc) return {};
    const src = doc.generated_sections || {};
    const out = {};
    SECTION_ORDER.forEach(({ key }) => { out[key] = src[key] || ""; });
    return out;
  }, [doc]);

  const patchSection = async (key, newMd) => {
    setSavingKey(key);
    try {
      const { data } = await api.patch(`/docwright/documents/${docId}`, {
        generated_sections: { [key]: newMd },
      });
      setDoc(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSavingKey(null);
    }
  };

  const regenerateSection = async (key) => {
    setRegenKey(key); setError(null);
    try {
      const { data } = await api.post(`/docwright/documents/${docId}/regenerate-section`, {
        section_key: key,
      });
      setDoc(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setRegenKey(null);
    }
  };

  const downloadBlob = async (kind) => {
    try {
      const resp = await api.get(`/docwright/documents/${docId}/download.${kind}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      const disp = resp.headers["content-disposition"] || "";
      const m = /filename="?([^"]+)"?/i.exec(disp);
      a.download = m ? m[1] : `docwright.${kind}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const copyMarkdown = async () => {
    if (!doc) return;
    const md = SECTION_ORDER
      .map(({ key, label }) => `# ${label}\n\n${sectionsMd[key] || ""}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(md);
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1600);
    } catch {
      setError("Clipboard copy failed — your browser may block it.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]" data-testid="docwright-result-loading">
        <NavHeader />
        <div className="max-w-6xl mx-auto px-6 py-16 text-center text-[#64748B]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          Loading document…
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <NavHeader />
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="text-sm text-[#B91C1C] mb-4">{error}</div>
          <button
            type="button" onClick={() => navigate("/docwright")}
            className="inline-flex items-center gap-1.5 text-sm text-[#0D9373] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Docwright
          </button>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="docwright-result">
      <NavHeader />

      {/* Sticky action bar */}
      <div className="sticky top-20 z-30 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button" onClick={() => navigate("/docwright")}
            className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0A1628]"
            data-testid="docwright-back-button"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => downloadBlob("docx")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-xs font-semibold"
              data-testid="docwright-download-docx"
            >
              <Download className="w-3.5 h-3.5" /> .docx
            </button>
            <button
              type="button" onClick={() => downloadBlob("pdf")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-xs font-semibold"
              data-testid="docwright-download-pdf"
            >
              <FileDown className="w-3.5 h-3.5" /> .pdf
            </button>
            <button
              type="button" onClick={copyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8F0] hover:border-[#0D9373] text-xs font-semibold text-[#0A1628]"
              data-testid="docwright-copy-markdown"
            >
              {copiedFlash ? <><CheckCircle2 className="w-3.5 h-3.5 text-[#0D9373]" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy as Markdown</>}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded px-3 py-2" data-testid="docwright-result-error">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[144px]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">Sections</div>
              <nav className="space-y-1" data-testid="docwright-sidebar">
                {SECTION_ORDER.map(({ key, label }) => (
                  <a
                    key={key}
                    href={`#sec-${key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="block px-3 py-1.5 text-sm text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9] rounded-md"
                    data-testid={`docwright-sidebar-${key}`}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Document preview */}
          <article className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden" data-testid="docwright-preview">
            <header className="px-8 py-6 border-b border-[#F1F5F9]">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#0D9373] mb-2">
                {doc.doc_type}
              </div>
              <h1 className="font-heading text-2xl font-bold text-[#0A1628]" data-testid="docwright-title">
                {doc.client_name} — {doc.module}
              </h1>
              <div className="text-xs text-[#64748B] mt-1">
                Phase: {doc.phase} · Last updated: {new Date(doc.updated_at).toLocaleString()}
              </div>
            </header>

            <div className="px-8 py-8 space-y-10 font-serif text-[15px] leading-relaxed text-[#0F172A]">
              {SECTION_ORDER.map(({ key, label }) => (
                <SectionEditor
                  key={key}
                  sectionKey={key}
                  label={label}
                  markdown={sectionsMd[key] || ""}
                  saving={savingKey === key}
                  regenerating={regenKey === key}
                  onSave={(md) => patchSection(key, md)}
                  onRegenerate={() => regenerateSection(key)}
                />
              ))}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}

// ── Section editor with inline edit + hover-only "Regenerate section" ──────
function SectionEditor({ sectionKey, label, markdown, saving, regenerating, onSave, onRegenerate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(markdown);
  const areaRef = useRef(null);

  useEffect(() => { setDraft(markdown); }, [markdown]);

  useEffect(() => {
    if (editing) setTimeout(() => areaRef.current?.focus(), 0);
  }, [editing]);

  const save = async () => {
    if (draft === markdown) { setEditing(false); return; }
    await onSave(draft);
    setEditing(false);
  };

  const cancel = () => { setDraft(markdown); setEditing(false); };

  return (
    <section id={`sec-${sectionKey}`} className="group" data-testid={`docwright-section-${sectionKey}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-heading font-bold text-xl text-[#0A1628] border-b border-[#E2E8F0] pb-1 flex-1">{label}</h2>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shrink-0">
          {!editing && (
            <button
              type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#0A1628]"
              data-testid={`docwright-edit-${sectionKey}`}
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          )}
          <button
            type="button" onClick={onRegenerate} disabled={regenerating}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#0A1628] disabled:opacity-50"
            data-testid={`docwright-regenerate-${sectionKey}`}
          >
            {regenerating ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</> : <><RefreshCw className="w-3 h-3" /> Regenerate section</>}
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(28, Math.max(6, draft.split("\n").length + 1))}
            data-testid={`docwright-textarea-${sectionKey}`}
            className="w-full px-3 py-3 text-sm font-mono border border-[#0D9373] rounded-md focus:outline-none resize-y bg-[#F8FAFC]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button" onClick={save} disabled={saving}
              className="px-3 py-1.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-xs font-semibold disabled:opacity-60"
              data-testid={`docwright-save-${sectionKey}`}
            >
              {saving ? <><Loader2 className="inline w-3 h-3 animate-spin mr-1" /> Saving…</> : "Save"}
            </button>
            <button
              type="button" onClick={cancel}
              className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:text-[#0A1628]"
              data-testid={`docwright-cancel-${sectionKey}`}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="docwright-md prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {markdown || "_No content._"}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}

// ── Markdown component overrides — real tables + OPEN ITEM highlight ───────
const mdComponents = {
  table: ({ node, ...p }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => (
    <th className="border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 text-left font-semibold" {...p} />
  ),
  td: ({ node, ...p }) => (
    <td className="border border-[#CBD5E1] px-3 py-2 align-top" {...p} />
  ),
  h2: ({ node, ...p }) => <h3 className="font-heading font-semibold text-lg mt-4 mb-1 text-[#0A1628]" {...p} />,
  h3: ({ node, ...p }) => <h4 className="font-heading font-semibold text-base mt-3 mb-1 text-[#0A1628]" {...p} />,
  strong: ({ node, children, ...p }) => {
    const raw = React.Children.toArray(children).map((c) => (typeof c === "string" ? c : "")).join("");
    if (/OPEN ITEM:/i.test(raw)) {
      return (
        <strong className="bg-[#FEF3C7] text-[#8A6100] px-1.5 py-0.5 rounded" {...p}>{children}</strong>
      );
    }
    return <strong {...p}>{children}</strong>;
  },
  p: ({ node, children, ...p }) => {
    // Detect plain "OPEN ITEM: …" paragraphs and highlight them
    const raw = React.Children.toArray(children).map((c) => (typeof c === "string" ? c : "")).join("");
    if (/^\s*OPEN ITEM:/i.test(raw)) {
      return <p className="bg-[#FEF3C7] text-[#8A6100] rounded px-2 py-1 my-2 font-semibold" {...p}>{children}</p>;
    }
    return <p className="my-2" {...p}>{children}</p>;
  },
  ul: ({ node, ...p }) => <ul className="list-disc pl-6 my-2 space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-6 my-2 space-y-1" {...p} />,
};

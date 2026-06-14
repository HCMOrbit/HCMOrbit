import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, Eye, FileText, ArrowLeft, Save, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge } from "../../components/kb/KBBadges";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { loginHref } from "../../lib/redirect";
import { toast } from "sonner";

const DOC_TYPES = [
  { id: "fix_guide", label: "Fix guide", desc: "Symptom → cause → step-by-step resolution" },
  { id: "how_to", label: "How-to", desc: "Walkthrough of a configuration or implementation" },
  { id: "learning_bite", label: "Learning bite", desc: "Short explainer for a concept or framework" },
  { id: "reference", label: "Reference", desc: "Deep technical reference, tables, limits" },
  { id: "checklist", label: "Checklist", desc: "Audit list, pre/post go-live items" },
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const GROUPS = [
  { id: "aspirant", label: "Aspirants" },
  { id: "practitioner", label: "Practitioners" },
  { id: "employer", label: "Employers" },
];

const STARTER = `## The problem

Describe the symptom your reader will see, in plain language.

## Cause

Why this happens. The mechanism behind the symptom.

:::tip
Use Pro tip callouts to highlight non-obvious advice.
:::

## Fix

The exact steps to resolve it. Use code blocks for snippets:

\`\`\`
example code or config
\`\`\`

## Verification

How the reader confirms the fix worked.
`;

const MD_PREVIEW = {
  h2: ({ children }) => <h2 className="font-heading text-xl font-semibold mt-6 mb-3 pb-2 border-b border-[#E2E8F0] text-[#0A1628]">{children}</h2>,
  h3: ({ children }) => <h3 className="font-heading text-base font-semibold mt-5 mb-2 text-[#0A1628]">{children}</h3>,
  p: ({ children }) => {
    const text = Array.isArray(children) ? children.join("") : String(children);
    const m = text.match(/^:::(mistake|tip|warning|info)\s*([\s\S]*?):::\s*$/);
    if (m) return <Callout type={m[1]} content={m[2].trim()} />;
    return <p className="mb-3 leading-relaxed text-[#0F172A]">{children}</p>;
  },
  code: ({ inline, children }) => inline
    ? <code className="font-mono text-[0.85em] bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded">{children}</code>
    : <code className="block font-mono text-sm leading-relaxed">{children}</code>,
  pre: ({ children }) => <pre className="bg-[#0F172A] text-[#E2E8F0] p-4 rounded-lg overflow-x-auto my-3 text-sm">{children}</pre>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
};

export default function NewKBDoc() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [docType, setDocType] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [version, setVersion] = useState("2026 R1");
  const [tagsInput, setTagsInput] = useState("");
  const [targetGroups, setTargetGroups] = useState(["aspirant", "practitioner", "employer"]);
  const [body, setBody] = useState(STARTER);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(loginHref(location)); return; }
    if (!user.onboarded) { navigate("/onboarding"); return; }
    if (!user.is_admin) {
      toast.error("Only admins can add Knowledge Base documents.");
      navigate("/knowledge-base");
    }
  }, [user, authLoading, navigate, location]);

  useEffect(() => {
    api.get("/kb/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const tags = useMemo(
    () => tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    [tagsInput],
  );

  const canSubmit =
    docType &&
    categorySlug &&
    title.trim().length >= 10 &&
    summary.trim().length >= 30 &&
    body.trim().length >= 100 &&
    targetGroups.length > 0;

  const submit = async (publish) => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/kb/docs", {
        title: title.trim(),
        summary: summary.trim(),
        body,
        category_slug: categorySlug,
        doc_type: docType,
        difficulty,
        target_groups: targetGroups,
        tags,
        workday_version: version || null,
        publish,
      });
      if (publish) {
        toast.success("Published — thank you for contributing.");
        navigate(`/knowledge-base/${categorySlug}/${data.id}`);
      } else {
        toast.success("Saved as draft. You can publish later from the admin or by re-opening it.");
        navigate("/knowledge-base");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (g) =>
    setTargetGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  if (authLoading || !user) return <div className="min-h-screen bg-[#F1F5F9]" />;

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="new-kb-page">
      <NavHeader />
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8">
        <nav className="text-xs flex items-center gap-1.5 mb-4 text-[#64748B]">
          <button onClick={() => navigate("/knowledge-base")} className="text-[#0D9373] hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Knowledge Base
          </button>
          <ChevronRight className="w-3 h-3" />
          <span>Add a document</span>
        </nav>

        {step === 1 && (
          <div data-testid="new-kb-step1">
            <h1 className="font-heading text-3xl font-semibold text-[#0A1628]">Share what you know.</h1>
            <p className="text-sm text-[#64748B] mt-2 max-w-2xl">
              Knowledge Base documents are technical references that help other Workday practitioners — written from real experience, not vendor marketing. Pick a format that fits what you want to share.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
              {DOC_TYPES.map((t) => {
                const selected = docType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setDocType(t.id)}
                    data-testid={`select-doctype-${t.id}`}
                    className={`text-left p-5 rounded-xl border-2 transition-all bg-white ${selected ? "border-[#0D9373] shadow-md" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                  >
                    <DocTypeBadge type={t.id} />
                    <h3 className="font-heading font-semibold text-[#0A1628] mt-3">{t.label}</h3>
                    <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{t.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                disabled={!docType}
                data-testid="new-kb-next-btn"
                className="px-6 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm disabled:opacity-50 inline-flex items-center gap-1"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#94A3B8]">Step 1 of 2</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="new-kb-step2" className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setStep(1)} className="text-xs text-[#64748B] hover:text-[#0A1628]">← Change format</button>
                  <div className="flex items-center gap-2">
                    <DocTypeBadge type={docType} />
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <Field label="Title *" hint={`${title.length}/150`}>
                    <input
                      required maxLength={150}
                      value={title} onChange={(e) => setTitle(e.target.value)}
                      data-testid="kb-title-input"
                      placeholder="Be specific. Include module, symptom and context."
                      className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                    />
                  </Field>

                  <Field label="Summary *" hint={`${summary.length}/280`}>
                    <textarea
                      required maxLength={280}
                      value={summary} onChange={(e) => setSummary(e.target.value)}
                      data-testid="kb-summary-input"
                      placeholder="2–3 sentences. What a reader will learn or be able to do after reading."
                      className="w-full min-h-[80px] px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white leading-relaxed"
                    />
                  </Field>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Category *">
                      <select
                        required value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}
                        data-testid="kb-category-select"
                        className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm bg-white"
                      >
                        <option value="">Select…</option>
                        {categories.filter((c) => !c.is_hidden).map((c) => (
                          <option key={c.slug} value={c.slug}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Difficulty">
                      <select
                        value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                        data-testid="kb-difficulty-select"
                        className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm bg-white capitalize"
                      >
                        {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="Workday version">
                      <input
                        value={version} onChange={(e) => setVersion(e.target.value)}
                        data-testid="kb-version-input"
                        placeholder="2026 R1"
                        className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm bg-white"
                      />
                    </Field>
                  </div>

                  <Field label="Tags" hint="comma separated · up to 8">
                    <input
                      value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                      data-testid="kb-tags-input"
                      placeholder="eib, xslt, encoding"
                      className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm bg-white font-mono"
                    />
                    {tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[10px] text-[#475569] font-mono">{t}</span>
                        ))}
                      </div>
                    )}
                  </Field>

                  <Field label="Written for *">
                    <div className="flex flex-wrap gap-2" data-testid="kb-target-groups">
                      {GROUPS.map((g) => {
                        const on = targetGroups.includes(g.id);
                        return (
                          <button
                            key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                            data-testid={`kb-group-${g.id}`}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#0D9373] text-white border-[#0D9373]" : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#0A1628]">
                    <FileText className="w-4 h-4" /> Body
                    <span className="text-xs text-[#94A3B8] font-normal">{body.length} chars · markdown supported</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewMode((p) => !p)}
                    data-testid="kb-preview-toggle"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]"
                  >
                    <Eye className="w-3.5 h-3.5" /> {previewMode ? "Edit" : "Preview"}
                  </button>
                </div>
                {previewMode ? (
                  <article className="p-6 kb-prose" data-testid="kb-preview">
                    <h1 className="font-heading text-2xl font-bold text-[#0A1628] mb-2">{title || "Untitled document"}</h1>
                    <p className="text-[#64748B] mb-5">{summary || "Summary will appear here."}</p>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_PREVIEW}>
                      {preprocessCallouts(body)}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <textarea
                    value={body} onChange={(e) => setBody(e.target.value)}
                    data-testid="kb-body-textarea"
                    className="w-full min-h-[460px] px-4 py-4 outline-none text-sm font-mono leading-relaxed bg-white border-0 resize-y"
                    placeholder="Write your document in Markdown."
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={!canSubmit || submitting}
                  data-testid="kb-save-draft-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-[#E2E8F0] hover:border-[#94A3B8] text-sm font-medium text-[#475569] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save as draft
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={!canSubmit || submitting}
                  data-testid="kb-publish-btn"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {submitting ? "Publishing…" : "Publish document"}
                </button>
              </div>
            </div>

            <aside className="bg-white border border-[#E2E8F0] rounded-lg p-6 h-fit lg:sticky lg:top-20">
              <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Writing tips</div>
              <h3 className="font-heading font-semibold text-sm text-[#0A1628] mb-3">A great KB document…</h3>
              <ul className="space-y-2.5 text-sm text-[#475569] leading-relaxed">
                <li>✓ Starts with the symptom or use case</li>
                <li>✓ Names the Workday module(s) and version</li>
                <li>✓ Includes the exact configuration that worked</li>
                <li>✓ Calls out common mistakes with <code className="text-xs bg-[#F1F5F9] px-1 rounded">:::mistake</code></li>
                <li>✓ Ends with a verification step</li>
              </ul>
              <div className="mt-5 p-3 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569] leading-relaxed">
                <div className="font-semibold text-[#0A1628] mb-1">Markdown reference</div>
                <div className="font-mono text-[11px] whitespace-pre-line text-[#64748B]">{`## Section\n**bold**, *italic*\n\n\`\`\`code\`\`\`\n\n- list item\n\n:::tip\nshort tip\n:::`}</div>
              </div>
              <div className="mt-5 pt-5 border-t border-[#F1F5F9]">
                <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                  <DifficultyBadge level={difficulty} />
                  <span>preview as {difficulty}</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#475569]">{label}</label>
        {hint && <span className="text-xs text-[#94A3B8] counter">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function preprocessCallouts(body) {
  if (!body) return "";
  return body.replace(/:::(mistake|tip|warning|info)\n([\s\S]*?)\n:::/g, (_m, type, content) => `:::${type}\n${content.replace(/\n/g, " ")}\n:::`);
}

function Callout({ type, content }) {
  const VARIANTS = {
    mistake: { bg: "#FFF1F2", border: "#F43F5E", label: "Common mistake" },
    tip: { bg: "#F0FDF4", border: "#22C55E", label: "Pro tip" },
    warning: { bg: "#FFFBEB", border: "#F59E0B", label: "Warning" },
    info: { bg: "#EFF6FF", border: "#3B82F6", label: "Note" },
  };
  const v = VARIANTS[type] || VARIANTS.info;
  return (
    <div className="my-3 px-4 py-3 rounded-r" style={{ background: v.bg, borderLeft: `3px solid ${v.border}` }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: v.border }}>{v.label}</div>
      <div className="text-sm text-[#0F172A] leading-relaxed">{content}</div>
    </div>
  );
}

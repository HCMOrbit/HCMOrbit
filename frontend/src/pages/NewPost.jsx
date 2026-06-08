import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CircleHelp, MessagesSquare, Trophy, ChevronRight } from "lucide-react";
import NavHeader from "../components/NavHeader";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

const TYPES = [
  { id: "question", title: "Question", desc: "I need help with something specific", icon: CircleHelp, color: "#0D9373" },
  { id: "discussion", title: "Discussion", desc: "I want to explore a topic with the community", icon: MessagesSquare, color: "#1D6FE8" },
  { id: "success_story", title: "Success Story", desc: "I solved something hard and want to share it", icon: Trophy, color: "#16A34A" },
];

export default function NewPost() {
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [type, setType] = useState(params.get("type") || "");
  const [spaceSlug, setSpaceSlug] = useState(params.get("space") || "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login");
    else if (!user.onboarded) navigate("/onboarding");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    api.get("/spaces").then((r) => setSpaces(r.data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5);
      const { data } = await api.post("/posts", {
        space_slug: spaceSlug, type, title, body, tags,
      });
      toast.success(`Your ${type.replace("_", " ")} is live.`);
      navigate(`/community/posts/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSpace = spaces.find((s) => s.slug === spaceSlug);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="new-post-page">
      <NavHeader />
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-8">
        {step === 1 && (
          <div data-testid="new-post-step1">
            <div className="mb-8">
              <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">What kind of post is this?</h1>
              <p className="text-sm text-[#64748B] mt-1">Pick the format that matches your intent.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const selected = type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    data-testid={`select-type-${t.id}`}
                    className={`text-left p-6 rounded-xl border-2 transition-all bg-white ${selected ? "shadow-md" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                    style={selected ? { borderColor: t.color } : {}}
                  >
                    <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${t.color}15` }}>
                      <Icon className="w-5 h-5" style={{ color: t.color }} />
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-[#0A1628] mt-4">{t.title}</h3>
                    <p className="text-sm text-[#64748B] mt-1.5 leading-relaxed">{t.desc}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={!type}
                data-testid="new-post-next-btn"
                className="px-6 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm disabled:opacity-50"
              >
                Continue <ChevronRight className="inline w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={submit} className="grid lg:grid-cols-3 gap-6" data-testid="new-post-step2">
            <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8">
              <div className="mb-5">
                <button type="button" onClick={() => setStep(1)} className="text-xs text-[#64748B] hover:text-[#0A1628]">← Change post type</button>
              </div>
              <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Compose your {TYPES.find((t) => t.id === type)?.title.toLowerCase()}</h1>

              <div className="mt-6 flex flex-col gap-5">
                <div>
                  <label className="text-xs font-medium text-[#475569]">Space *</label>
                  <select required value={spaceSlug} onChange={(e) => setSpaceSlug(e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white" data-testid="space-select">
                    <option value="">Select a space...</option>
                    {spaces.map((s) => (<option key={s.slug} value={s.slug}>{s.name}</option>))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#475569]">Title *</label>
                    <span className="text-xs text-[#94A3B8] counter">{title.length}/150</span>
                  </div>
                  <input
                    required minLength={10} maxLength={150}
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                    placeholder="Be specific. Include module, version, and the actual symptom."
                    data-testid="title-input"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#475569]">Tags <span className="text-[#94A3B8]">(comma separated, up to 5)</span></label>
                  <input
                    value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white font-mono"
                    placeholder="eib, xslt, integrations"
                    data-testid="tags-input"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#475569]">Body *</label>
                    <span className="text-xs text-[#94A3B8] counter">{body.length} chars</span>
                  </div>
                  <textarea
                    required minLength={30}
                    value={body} onChange={(e) => setBody(e.target.value)}
                    className="mt-1.5 w-full min-h-[260px] px-3.5 py-3 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm font-mono leading-relaxed bg-white"
                    placeholder="Markdown supported. Use ``` for code blocks, **bold**, * lists *, etc."
                    data-testid="body-textarea"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!spaceSlug || title.length < 10 || body.length < 30 || submitting}
                  data-testid="submit-post-btn"
                  className="w-full py-3 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? "Posting..." : `Post to ${selectedSpace?.name || "Space"}`}
                </button>
              </div>
            </div>

            {/* Guidance */}
            <aside className="bg-white border border-[#E2E8F0] rounded-lg p-6 h-fit sticky top-20">
              <div className="text-xs uppercase tracking-wider text-[#0D9373] font-semibold mb-3">Guidance</div>
              {type === "question" && (
                <div>
                  <h3 className="font-heading font-semibold text-sm text-[#0A1628] mb-3">Great questions include:</h3>
                  <ul className="space-y-2.5 text-sm text-[#475569]">
                    <li>✓ What did you try?</li>
                    <li>✓ What happened (exact symptom)?</li>
                    <li>✓ What did you expect?</li>
                    <li>✓ Module name and version context</li>
                    <li>✓ Relevant config/code snippets</li>
                  </ul>
                  <div className="mt-5 p-3 rounded bg-[#F8FAFC] text-xs text-[#64748B] leading-relaxed">
                    Instead of <em className="text-[#DC2626] not-italic">"EIB not working"</em>, try:<br />
                    <em className="text-[#16A34A] not-italic">"EIB inbound fails silently when date field is blank — no error log generated"</em>
                  </div>
                </div>
              )}
              {type === "success_story" && (
                <div>
                  <h3 className="font-heading font-semibold text-sm text-[#0A1628] mb-3">Frame your story:</h3>
                  <ol className="space-y-2.5 text-sm text-[#475569] list-decimal pl-4">
                    <li>Context — the setup</li>
                    <li>Problem — what was broken</li>
                    <li>What I tried — including dead ends</li>
                    <li>What worked — the actual fix</li>
                    <li>Key lesson — what others should take away</li>
                  </ol>
                  <p className="mt-5 text-xs text-[#64748B] leading-relaxed">Walk us through your story. The more detail, the more it helps others.</p>
                </div>
              )}
              {type === "discussion" && (
                <div>
                  <h3 className="font-heading font-semibold text-sm text-[#0A1628] mb-3">Discussion tips:</h3>
                  <ul className="space-y-2.5 text-sm text-[#475569]">
                    <li>· Frame with a clear question or point of view</li>
                    <li>· What should others weigh in on?</li>
                    <li>· Share your current thinking, not just the prompt</li>
                  </ul>
                </div>
              )}
            </aside>
          </form>
        )}
      </div>
    </div>
  );
}

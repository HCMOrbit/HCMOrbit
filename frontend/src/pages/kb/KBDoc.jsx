import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ArrowLeft, Bookmark, ThumbsUp, ThumbsDown, Users, Share2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, DifficultyBadge, VersionPill } from "../../components/kb/KBBadges";
import GroupBadge from "../../components/GroupBadge";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { toast } from "sonner";

export default function KBDoc() {
  const { slug, docId } = useParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("");

  const load = useCallback(() => {
    api.get(`/kb/docs/${docId}`).then((r) => setDoc(r.data)).catch(() => {});
    if (user) {
      api.get(`/kb/docs/${docId}/helpful/me`).then((r) => setMyVote(r.data.value)).catch(() => {});
    }
  }, [docId, user]);
  useEffect(load, [load]);

  const headings = useMemo(() => {
    if (!doc?.body) return [];
    const lines = doc.body.split("\n");
    return lines.filter((l) => /^##\s+|^###\s+/.test(l)).map((l) => {
      const level = l.startsWith("### ") ? 3 : 2;
      const text = l.replace(/^#+\s+/, "").trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      return { id, text, level };
    });
  }, [doc?.body]);

  useEffect(() => {
    if (!headings.length) return;
    const onScroll = () => {
      const offsets = headings.map((h) => {
        const el = document.getElementById(h.id);
        return { id: h.id, top: el ? el.getBoundingClientRect().top : 9999 };
      }).filter((h) => h.top < 120);
      setActiveAnchor(offsets.length ? offsets[offsets.length - 1].id : headings[0]?.id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [headings]);

  const vote = async (value) => {
    if (!user) { toast.message("Join HCMOrbit to rate this document"); return; }
    try {
      const { data } = await api.post(`/kb/docs/${docId}/helpful`, { value });
      setDoc((p) => ({ ...p, helpful_count: data.helpful_count, not_helpful_count: data.not_helpful_count }));
      setMyVote(value);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const toggleBookmark = async () => {
    if (!user) { toast.message("Sign in to bookmark"); return; }
    try {
      const { data } = await api.post(`/kb/bookmarks/${docId}`);
      setBookmarked(data.bookmarked);
      toast.success(data.bookmarked ? "Saved." : "Removed.");
    } catch { toast.error("Couldn't save"); }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard.");
    } catch { toast.error("Couldn't copy"); }
  };

  if (!doc) return <div className="min-h-screen bg-[#F1F5F9]"><NavHeader /><div className="text-center py-24 text-[#94A3B8]">Loading...</div></div>;

  const totalVotes = (doc.helpful_count || 0) + (doc.not_helpful_count || 0);
  const helpfulPct = totalVotes > 0 ? Math.round(100 * doc.helpful_count / totalVotes) : 0;

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-doc">
      <NavHeader />
      <div className="max-w-[1300px] mx-auto px-4 lg:px-8 py-6 flex gap-6">
        <aside className="w-[175px] shrink-0 hidden lg:flex flex-col gap-5 sticky top-20 self-start" data-testid="kb-doc-sidebar">
          {headings.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">In this document</div>
              <div className="flex flex-col gap-0.5">
                {headings.map((h) => (
                  <a key={h.id} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className={`text-xs py-1.5 px-2 rounded transition-colors ${activeAnchor === h.id ? "bg-[#F0FDF4] text-[#0D9373] font-medium border-l-2 border-[#0D9373]" : "text-[#475569] hover:bg-[#F8FAFC]"}`}
                    data-testid={`toc-${h.id}`}>{h.text}</a>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">Navigate</div>
            <Link to={`/knowledge-base/${slug}`} className="flex items-center gap-1.5 text-xs text-[#0D9373] hover:underline py-1">
              <ArrowLeft className="w-3 h-3" /> All {doc.category?.name} documents
            </Link>
          </div>
          {doc.related?.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">Related</div>
              <div className="flex flex-col gap-2">
                {doc.related.map((r) => (
                  <Link key={r.id} to={`/knowledge-base/${slug}/${r.id}`} className="text-xs text-[#1D6FE8] hover:underline leading-snug">{r.title}</Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0">
          <nav className="text-xs flex items-center gap-1.5 mb-3 text-[#64748B]">
            <Link to="/knowledge-base" className="text-[#0D9373] hover:underline">Knowledge Base</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/knowledge-base/${slug}`} className="text-[#0D9373] hover:underline">{doc.category?.name}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="truncate">{doc.title.slice(0, 60)}</span>
          </nav>

          <div className="bg-[#0A1628] text-white rounded-xl p-7 mb-5">
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <DocTypeBadge type={doc.doc_type} />
              <DifficultyBadge level={doc.difficulty} />
              <VersionPill version={doc.workday_version} />
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 border border-white/20">{doc.category?.name}</span>
            </div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight" data-testid="doc-title">{doc.title}</h1>
            <p className="mt-3 text-white/70 leading-relaxed">{doc.summary}</p>
            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">{(doc.author?.full_name || "U")[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {doc.author?.full_name}
                  <GroupBadge group={doc.author?.group_type} />
                </div>
                <div className="text-xs text-white/50 mt-0.5"><span className="counter">{doc.author?.reputation_score}</span> rep · {timeAgo(doc.created_at)}</div>
              </div>
              <button onClick={toggleBookmark} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium" data-testid="kb-bookmark-btn">
                <Bookmark className="w-3.5 h-3.5" fill={bookmarked ? "currentColor" : "none"} /> {bookmarked ? "Saved" : "Save"}
              </button>
              <button onClick={share} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium" data-testid="kb-share-btn">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg px-5 py-3 mb-5 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
            <Users className="w-4 h-4" />
            <span className="font-medium text-[#475569]">Written for:</span>
            {(doc.target_groups || []).map((g) => <GroupBadge key={g} group={g} />)}
            <span className="ml-auto counter">{doc.view_count} views</span>
          </div>

          <article className="bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8 kb-prose" data-testid="doc-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              h2: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                return <h2 id={id} className="font-heading text-xl font-semibold mt-8 mb-4 pb-2 border-b border-[#E2E8F0] text-[#0A1628] scroll-mt-20">{children}</h2>;
              },
              h3: ({ children }) => {
                const text = String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                return <h3 id={id} className="font-heading text-base font-semibold mt-6 mb-3 text-[#0A1628] scroll-mt-20">{children}</h3>;
              },
              p: ({ children }) => {
                const text = Array.isArray(children) ? children.join("") : String(children);
                const m = text.match(/^:::(mistake|tip|warning|info)\s*([\s\S]*?):::\s*$/);
                if (m) return <Callout type={m[1]} content={m[2].trim()} />;
                return <p className="mb-4 leading-relaxed text-[#0F172A]">{children}</p>;
              },
              code: ({ inline, children }) => inline
                ? <code className="font-mono text-[0.85em] bg-[#F1F5F9] text-[#0F172A] px-1.5 py-0.5 rounded">{children}</code>
                : <code className="block font-mono text-sm leading-relaxed">{children}</code>,
              pre: ({ children }) => <pre className="bg-[#0F172A] text-[#E2E8F0] p-4 rounded-lg overflow-x-auto my-4 text-sm">{children}</pre>,
              ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>,
              blockquote: ({ children }) => <blockquote className="border-l-3 border-[#0D9373] pl-4 text-[#475569] italic my-4">{children}</blockquote>,
              table: ({ children }) => <div className="overflow-x-auto my-4"><table className="w-full text-sm border-collapse">{children}</table></div>,
              th: ({ children }) => <th className="bg-[#F8FAFC] text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider border border-[#E2E8F0]">{children}</th>,
              td: ({ children }) => <td className="px-3 py-2 border border-[#E2E8F0]">{children}</td>,
            }}>{preprocessCallouts(doc.body)}</ReactMarkdown>
          </article>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mt-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6" data-testid="kb-ask-discussion">
            <div className="w-12 h-12 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-semibold text-[#0A1628]">Have a question about this topic?</div>
              <div className="text-sm text-[#64748B] mt-1 leading-relaxed">
                Ask the community. Practitioners who&apos;ve worked through this exact scenario will see it.
              </div>
            </div>
            <Link
              to={buildAskDiscussionHref(doc, slug, docId)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold transition-colors shrink-0"
              data-testid="kb-ask-discussion-cta"
            >
              <MessageSquare className="w-4 h-4" /> Ask in Discussions
            </Link>
          </div>


          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mt-5" data-testid="kb-helpful-widget">
            <div className="font-heading font-semibold text-[#0A1628]">Was this document helpful?</div>
            <div className="text-xs text-[#64748B] mt-1">{totalVotes} {totalVotes === 1 ? "person has" : "people have"} rated this document · {helpfulPct}% found it helpful</div>
            {!user ? (
              <Link to="/login" className="inline-block mt-4 text-sm text-[#0D9373] hover:underline">Join HCMOrbit to rate this document →</Link>
            ) : myVote ? (
              <div className={`mt-4 text-sm ${myVote === "helpful" ? "text-[#16A34A]" : "text-[#64748B]"}`} data-testid="kb-helpful-confirmation">
                {myVote === "helpful" ? `Thanks — glad it helped. ${doc.helpful_count} people have now rated this helpful.` : "Thanks for the feedback. We'll work on improving this."}
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button onClick={() => vote("helpful")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium" data-testid="kb-helpful-yes">
                  <ThumbsUp className="w-4 h-4" /> Yes, it helped
                </button>
                <button onClick={() => vote("not_helpful")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-[#E2E8F0] hover:border-[#94A3B8] text-sm font-medium text-[#475569]" data-testid="kb-helpful-no">
                  <ThumbsDown className="w-4 h-4" /> Needs improvement
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function preprocessCallouts(body) {
  if (!body) return "";
  // Convert :::tip ... ::: blocks into single-paragraph markers that the p renderer detects
  return body.replace(/:::(mistake|tip|warning|info)\n([\s\S]*?)\n:::/g, (_m, type, content) => `:::${type}\n${content.replace(/\n/g, " ")}\n:::`);
}

function buildAskDiscussionHref(doc, slug, docId) {
  const title = `Re: ${doc?.title || "Knowledge Base topic"}`;
  const link = `${window.location.origin}/knowledge-base/${slug}/${docId}`;
  const body = `Referencing the Knowledge Base article: ${doc?.title || ""}\n${link}\n\n---\n\nMy question:\n\n`;
  const tags = (doc?.tags || []).slice(0, 3).join(",");
  const params = new URLSearchParams({ type: "question", title, body });
  if (tags) params.set("tags", tags);
  return `/community/new-post?${params.toString()}`;
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
    <div className="my-4 px-4 py-3 rounded-r" style={{ background: v.bg, borderLeft: `3px solid ${v.border}` }} data-testid={`callout-${type}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: v.border }}>{v.label}</div>
      <div className="text-sm text-[#0F172A] leading-relaxed">{content}</div>
    </div>
  );
}

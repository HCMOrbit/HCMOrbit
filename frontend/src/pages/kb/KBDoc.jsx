import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { ChevronRight, ArrowLeft, Bookmark, ThumbsUp, ThumbsDown, Share2, Eye, MessageSquare, Info, Lightbulb, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "../../components/NavHeader";
import { DocTypeBadge, VersionPill } from "../../components/kb/KBBadges";
import useResizable from "../../components/kb/useResizable";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { loginHref } from "../../lib/redirect";
import AuthPrompt from "../../components/AuthPrompt";
import { toast } from "sonner";

export default function KBDoc() {
  const { slug, docId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [doc, setDoc] = useState(null);
  // myVote: true=helpful, false=not_helpful, null=hasn't voted
  const [myVote, setMyVote] = useState(null);
  const [voteJustSaved, setVoteJustSaved] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("");

  // Resizable TOC — same hook as the category sidebar, distinct storage key.
  const { width: tocWidth, startDrag: startTocDrag, isDragging: isTocDragging } = useResizable({
    storageKey: "kbTocWidth",
    defaultWidth: 260,
    min: 200,
    max: 420,
  });

  // Match the TOC's existing visibility breakpoint (Tailwind `lg` = 1024px).
  // Below lg the TOC is hidden, so the handle is too — no UI fallback needed
  // beyond that. The 768px mobile guard is naturally satisfied because lg
  // already hides everything narrower than 1024px.
  const [isWide, setIsWide] = useState(
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsWide(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const effectiveTocWidth = isWide ? tocWidth : 250;

  // Right-rail (Navigate + Related) inline-vs-below breakpoint. Above ~1100px
  // it sits beside the article body as a third column; below, it collapses to
  // a full-width block under the body so we never cram three columns into a
  // narrow viewport.
  const [isThreeCol, setIsThreeCol] = useState(
    typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const handler = (e) => setIsThreeCol(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const load = useCallback(() => {
    api.get(`/kb/docs/${docId}`).then((r) => setDoc(r.data)).catch(() => {});
    if (user) {
      api.get(`/kb/docs/${docId}/feedback`).then((r) => setMyVote(r.data.helpful)).catch(() => {});
    }
  }, [docId, user]);
  useEffect(load, [load]);

  const headings = useMemo(() => {
    if (!doc?.body) return [];
    const lines = doc.body.split("\n");
    return lines.filter((l) => /^##\s+|^###\s+/.test(l)).map((l) => {
      const level = l.startsWith("### ") ? 3 : 2;
      const text = cleanHeadingText(l.replace(/^#+\s+/, ""));
      return { id: slugify(text), text, level };
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

  useEffect(() => {
    if (!activeAnchor) return;
    const link = document.querySelector(`[data-testid="toc-${activeAnchor}"]`);
    if (link) link.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeAnchor]);

  const vote = async (helpful) => {
    if (!user) return;
    if (myVote === helpful) return;
    const prev = myVote;
    setMyVote(helpful); // optimistic
    try {
      const { data } = await api.post(`/kb/docs/${docId}/feedback`, { helpful });
      setDoc((p) => ({ ...p, helpful_count: data.helpful_count, not_helpful_count: data.not_helpful_count }));
      setVoteJustSaved(true);
      setTimeout(() => setVoteJustSaved(false), 3500);
    } catch (e) {
      setMyVote(prev);
      toast.error(formatApiError(e));
    }
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

  // Right-rail content (Navigate + Related). Rendered in two positions:
  //  - At ≥1100px: as a 3rd column beside the article body (sticky).
  //  - Below 1100px: as a full-width block under the body.
  // Defined once so both call sites share the same source of truth.
  const rightRailContent = (
    <>
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-4" data-testid="kb-doc-navigate-block">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">Navigate</div>
        <Link to={`/knowledge-base/${slug}`} className="flex items-center gap-1.5 text-xs text-[#0D9373] hover:underline py-1">
          <ArrowLeft className="w-3 h-3" /> All {doc.category?.name} documents
        </Link>
      </div>
      {doc.related?.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-4" data-testid="kb-doc-related-block">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">Related</div>
          <div className="flex flex-col gap-2">
            {doc.related.map((r) => (
              <Link key={r.id} to={`/knowledge-base/${slug}/${r.id}`} className="text-xs text-[#1D6FE8] hover:underline leading-snug">{r.title}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="kb-doc">
      <NavHeader />

      {/* Full-width dark hero */}
      <section className="bg-[#0A1628] text-white" data-testid="kb-doc-hero">
        <div className="max-w-[1300px] mx-auto px-4 lg:px-8 pt-5 pb-8">
          <div className="flex items-center gap-3 mb-5">
            <nav className="text-xs flex items-center gap-1.5 text-white/60 flex-1 min-w-0" data-testid="kb-doc-breadcrumb">
              <Link to="/knowledge-base" className="text-white/80 hover:text-white hover:underline">Knowledge Base</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to={`/knowledge-base/${slug}`} className="text-white/80 hover:text-white hover:underline">{doc.category?.name}</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="truncate" style={{ color: "#F5B731", fontWeight: 600 }}>{doc.title.slice(0, 60)}</span>
            </nav>
            <div className="shrink-0 flex items-center gap-2">
              <button onClick={toggleBookmark} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium" data-testid="kb-bookmark-btn">
                <Bookmark className="w-3.5 h-3.5" fill={bookmarked ? "currentColor" : "none"} /> {bookmarked ? "Saved" : "Save"}
              </button>
              <button onClick={share} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium" data-testid="kb-share-btn">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <DocTypeBadge type={doc.doc_type} />
            {doc.difficulty && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider capitalize"
                style={{ background: "#fdf3dc", color: "#b5841a" }}
                data-testid="kb-doc-difficulty-gold"
              >
                {doc.difficulty}
              </span>
            )}
            <VersionPill version={doc.workday_version} />
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 border border-white/20">{doc.category?.name}</span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 border border-white/20"
              data-testid="kb-view-count"
            >
              <Eye className="w-3 h-3" />
              <span className="counter">{doc.view_count}</span>
              <span>views</span>
            </span>
          </div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight" data-testid="doc-title">{doc.title}</h1>
          {(doc.reference_id || doc.read_time) && (
            <div className="mt-2 text-xs font-mono flex items-center gap-2 flex-wrap" data-testid="doc-ref-strip">
              {doc.reference_id && <span style={{ color: "#F5B731" }}>{doc.reference_id}</span>}
              {doc.reference_id && doc.read_time && <span className="text-white/30">·</span>}
              {doc.read_time && <span className="text-white/55">{doc.read_time} read</span>}
            </div>
          )}
          <p className="mt-3 text-white/70 leading-relaxed max-w-3xl">{doc.summary}</p>
        </div>
      </section>

      <div className="max-w-[1300px] mx-auto px-4 lg:px-8 py-6 flex gap-0">
        {headings.length > 0 && (
        <aside
          className="shrink-0 hidden lg:flex flex-col gap-5 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto"
          style={{
            width: effectiveTocWidth,
            minWidth: effectiveTocWidth,
            maxWidth: effectiveTocWidth,
            scrollbarWidth: "thin",
            scrollbarColor: "#cbd5e1 transparent",
          }}
          data-testid="kb-doc-sidebar"
        >
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-3">In this document</div>
            <div className="flex flex-col gap-0.5">
              {headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={`text-xs py-1.5 px-2 rounded transition-colors leading-snug ${activeAnchor === h.id ? "bg-[#F0FDF4] text-[#0D9373] font-medium border-l-2 border-[#0D9373]" : "text-[#475569] hover:bg-[#F8FAFC]"} ${h.level === 3 ? "pl-4" : ""}`}
                  data-testid={`toc-${h.id}`}>{h.text}</a>
              ))}
            </div>
          </div>
        </aside>
        )}

        {isWide && headings.length > 0 && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize table of contents"
            onMouseDown={startTocDrag}
            data-testid="kb-toc-resizer"
            className="hidden lg:block shrink-0 sticky top-20 self-start"
            style={{
              width: 6,
              height: "calc(100vh - 6rem)",
              cursor: "col-resize",
              background: isTocDragging ? "#1DB589" : "transparent",
              transition: isTocDragging ? "none" : "background-color 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isTocDragging) e.currentTarget.style.background = "rgba(29,181,137,0.4)";
            }}
            onMouseLeave={(e) => {
              if (!isTocDragging) e.currentTarget.style.background = "transparent";
            }}
          />
        )}

        <main className="flex-1 min-w-0 lg:pl-6">
          <article className="bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8 kb-prose" data-testid="doc-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              h2: ({ children }) => {
                const text = cleanHeadingText(extractText(children));
                return <h2 id={slugify(text)} className="font-heading text-xl font-semibold mt-8 mb-4 pb-2 border-b border-[#E2E8F0] text-[#0A1628] scroll-mt-20">{children}</h2>;
              },
              h3: ({ children }) => {
                const text = cleanHeadingText(extractText(children));
                return <h3 id={slugify(text)} className="font-heading text-base font-semibold mt-6 mb-3 text-[#0A1628] scroll-mt-20">{children}</h3>;
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
              pre: ({ children }) => <KBPre>{children}</KBPre>,
              ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>,
              blockquote: ({ children }) => <BlockquoteCallout>{children}</BlockquoteCallout>,
              table: ({ children }) => <KBTable>{children}</KBTable>,
              th: ({ children }) => <th style={{ minWidth: "180px", width: "180px" }} className="bg-[#F8FAFC] text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider border border-[#E2E8F0] break-words align-top">{children}</th>,
              td: ({ children }) => <td style={{ minWidth: "180px", width: "180px" }} className="px-3 py-2 border border-[#E2E8F0] break-words align-top">{children}</td>,
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
              <div className="mt-4" data-testid="kb-helpful-auth-prompt">
                <AuthPrompt compact message="Sign in to rate this article" />
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2" data-testid="kb-helpful-buttons">
                  <button
                    type="button"
                    onClick={() => vote(true)}
                    aria-pressed={myVote === true}
                    data-testid="kb-helpful-yes"
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      myVote === true
                        ? "bg-[#0D9373] text-white border-[#0D9373]"
                        : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#0D9373] hover:text-[#0D9373]"
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${myVote === true ? "fill-current" : ""}`} /> Yes, it helped
                  </button>
                  <button
                    type="button"
                    onClick={() => vote(false)}
                    aria-pressed={myVote === false}
                    data-testid="kb-helpful-no"
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      myVote === false
                        ? "bg-[#0A1628] text-white border-[#0A1628]"
                        : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#0A1628] hover:text-[#0A1628]"
                    }`}
                  >
                    <ThumbsDown className={`w-4 h-4 ${myVote === false ? "fill-current" : ""}`} /> Needs improvement
                  </button>
                </div>
                {(voteJustSaved || myVote !== null) && (
                  <div
                    className={`mt-3 text-sm transition-opacity ${voteJustSaved ? "text-[#0D9373]" : "text-[#64748B]"}`}
                    data-testid="kb-helpful-confirmation"
                  >
                    {voteJustSaved
                      ? "Thanks for your feedback!"
                      : myVote === true
                      ? "You marked this helpful. Click the other option to change your vote."
                      : "You said this needs improvement. Click the other option to change your vote."}
                  </div>
                )}
              </div>
            )}
          </div>
          {!isThreeCol && (
            <div className="mt-5 flex flex-col gap-5" data-testid="kb-doc-right-rail-below">
              {rightRailContent}
            </div>
          )}
        </main>

        {isThreeCol && (
          <aside
            className="flex flex-col gap-5 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pl-6"
            style={{
              width: 280,
              minWidth: 280,
              maxWidth: 280,
              scrollbarWidth: "thin",
              scrollbarColor: "#cbd5e1 transparent",
            }}
            data-testid="kb-doc-right-rail"
          >
            {rightRailContent}
          </aside>
        )}
      </div>
    </div>
  );
}

function preprocessCallouts(body) {
  if (!body) return "";
  // Convert :::tip ... ::: blocks into single-paragraph markers that the p renderer detects
  return body.replace(/:::(mistake|tip|warning|info)\n([\s\S]*?)\n:::/g, (_m, type, content) => `:::${type}\n${content.replace(/\n/g, " ")}\n:::`);
}

function slugify(text) {
  return (text || "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanHeadingText(raw) {
  if (!raw) return "";
  return raw
    .replace(/`+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\\([\\`*_])/g, "$1")
    .trim();
}

function extractText(children) {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children.props && children.props.children !== undefined) return extractText(children.props.children);
  return "";
}


function useScrollOverflowAffordance() {
  const ref = React.useRef(null);
  const [overflowing, setOverflowing] = React.useState(false);
  const [hintHidden, setHintHidden] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setOverflowing(el.scrollWidth - el.clientWidth > 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const onScroll = () => {
      if (el.scrollLeft > 4) setHintHidden(true);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const t = setTimeout(() => setHintHidden(true), 8000);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  return { ref, overflowing, showHint: overflowing && !hintHidden };
}

function FadeOverlay({ color, rounded, testid }) {
  return (
    <div
      aria-hidden="true"
      data-testid={testid}
      className={`pointer-events-none absolute top-0 right-0 h-full w-12 ${rounded}`}
      style={{ background: `linear-gradient(to right, rgba(0,0,0,0), ${color})` }}
    />
  );
}

function ScrollHint({ testid }) {
  return (
    <div
      className="mt-2 text-[11px] text-[#94A3B8] flex items-center gap-1.5 transition-opacity"
      data-testid={testid}
    >
      <span aria-hidden="true">←</span> scroll <span aria-hidden="true">→</span>
    </div>
  );
}

function KBTable({ children }) {
  const { ref, overflowing, showHint } = useScrollOverflowAffordance();
  return (
    <div className="my-4" data-testid="kb-table-block">
      <div className="relative">
        <div ref={ref} className="overflow-x-auto border border-[#E2E8F0] rounded-lg" data-testid="kb-table-wrap">
          <table className="text-sm border-collapse w-max min-w-full" style={{ tableLayout: "fixed" }}>{children}</table>
        </div>
        {overflowing && <FadeOverlay color="rgba(255,255,255,0.95)" rounded="rounded-r-lg" testid="kb-table-fade" />}
      </div>
      {showHint && <ScrollHint testid="kb-table-scroll-hint" />}
    </div>
  );
}

function KBPre({ children }) {
  const { ref, overflowing, showHint } = useScrollOverflowAffordance();
  return (
    <div className="my-4" data-testid="kb-pre-block">
      <div className="relative">
        <pre ref={ref} className="bg-[#0F172A] text-[#E2E8F0] p-4 rounded-lg overflow-x-auto text-sm" data-testid="kb-pre-wrap">{children}</pre>
        {overflowing && <FadeOverlay color="rgba(15,23,40,0.98)" rounded="rounded-r-lg" testid="kb-pre-fade" />}
      </div>
      {showHint && <ScrollHint testid="kb-pre-scroll-hint" />}
    </div>
  );
}

function BlockquoteCallout({ children }) {
  const CALLOUT_VARIANTS = {
    note:      { bg: "#F0FDFA", border: "#0D9373", icon: Info,           label: "Note" },
    tip:       { bg: "#F0FDF4", border: "#22C55E", icon: Lightbulb,      label: "Tip" },
    warning:   { bg: "#FFFBEB", border: "#F59E0B", icon: AlertTriangle,  label: "Warning" },
    important: { bg: "#FFFBEB", border: "#F59E0B", icon: AlertTriangle,  label: "Important" },
  };

  // Detect a "Note:", "Tip:", "Warning:", "Important:" label on the first
  // child node and strip it from the visible text. The first child is
  // typically a <p> built by react-markdown from the blockquote's first
  // paragraph.
  const arr = React.Children.toArray(children);
  let kind = "note";
  for (let i = 0; i < arr.length; i++) {
    const node = arr[i];
    if (!React.isValidElement(node)) continue;
    const inner = React.Children.toArray(node.props.children);
    if (inner.length === 0) continue;
    const firstInner = inner[0];
    if (typeof firstInner !== "string") continue;
    const m = firstInner.match(/^\s*(Note|Tip|Warning|Important)\s*:\s*/i);
    if (!m) break;
    kind = m[1].toLowerCase();
    const rest = firstInner.slice(m[0].length);
    const newInner = rest ? [rest, ...inner.slice(1)] : inner.slice(1);
    arr[i] = React.cloneElement(node, {}, ...newInner);
    break;
  }

  const v = CALLOUT_VARIANTS[kind] || CALLOUT_VARIANTS.note;
  const Icon = v.icon;
  return (
    <aside
      className="my-5 px-5 py-4 rounded-lg flex gap-3 not-italic"
      style={{ background: v.bg, borderLeft: `4px solid ${v.border}` }}
      data-callout={kind}
      data-testid={`kb-callout-${kind}`}
    >
      <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: v.border }} />
      <div className="flex-1 min-w-0 text-[#0F172A] leading-relaxed">
        <span className="font-semibold" style={{ color: v.border }}>{v.label}: </span>
        {arr}
      </div>
    </aside>
  );
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

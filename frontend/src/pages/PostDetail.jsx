import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, MessageSquare, Eye, Bookmark, Share2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavHeader from "../components/NavHeader";
import GroupBadge from "../components/GroupBadge";
import PostTypeBadge from "../components/PostTypeBadge";
import VoteComponent from "../components/VoteComponent";
import { api, timeAgo, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [votes, setVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [newAnswer, setNewAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.get(`/posts/${id}`),
        api.get(`/posts/${id}/answers`),
      ]);
      setPost(p.data);
      setAnswers(a.data);
      if (user) {
        const ids = [p.data.id, ...a.data.map((x) => x.id)].join(",");
        const v = await api.get(`/votes/me?target_ids=${ids}`);
        setVotes(v.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (newAnswer.length < 50) { toast.error("Answer must be at least 50 characters"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/posts/${id}/answers`, { body: newAnswer });
      setAnswers([...answers, { ...data, comments: [] }]);
      setPost({ ...post, answer_count: post.answer_count + 1 });
      setNewAnswer("");
      toast.success("Your answer has been posted.");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const acceptAnswer = async (answerId) => {
    try {
      await api.post(`/posts/${id}/accept-answer`, { answer_id: answerId });
      toast.success("Answer accepted. Question is marked as solved.");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><NavHeader /><div className="text-center py-24 text-[#94A3B8]">Loading...</div></div>;
  if (!post) return <div className="min-h-screen bg-[#F8FAFC]"><NavHeader /><div className="text-center py-24 text-[#94A3B8]">Post not found.</div></div>;

  const isAuthor = user && user.user_id === post.author_id;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="post-detail-page">
      <NavHeader />
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-4 text-xs text-[#64748B] flex items-center gap-2">
          <Link to="/community" className="hover:text-[#0A1628]">Community</Link>
          <span className="text-[#94A3B8]">/</span>
          {post.space && (<><Link to={`/community/spaces/${post.space.slug}`} className="hover:text-[#0A1628]">{post.space.name}</Link><span className="text-[#94A3B8]">/</span></>)}
          <span className="text-[#94A3B8] truncate">{post.title.slice(0, 60)}</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <PostTypeBadge type={post.type} />
            {post.space && <span className="text-xs font-medium text-[#0D9373]">{post.space.name}</span>}
            {post.is_solved && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16A34A]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Solved
              </span>
            )}
          </div>
          <h1 className="font-heading text-2xl lg:text-3xl font-semibold text-[#0A1628] tracking-tight leading-tight" data-testid="post-title">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-[#64748B]">
            <Link to={`/profile/${post.author?.username}`} className="font-medium text-[#0F172A] hover:text-[#0D9373]">{post.author?.full_name}</Link>
            <GroupBadge group={post.author?.group_type} />
            <span className="counter">{post.author?.reputation_score} rep</span>
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
            <span className="ml-auto inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> <span className="counter">{post.view_count}</span> views</span>
          </div>

          <div className="mt-6 flex gap-6">
            <div className="hidden sm:block shrink-0">
              <VoteComponent
                targetId={post.id} targetType="post"
                initialCount={post.vote_count}
                initialVote={votes[post.id] || 0}
              />
              <div className="mt-3 flex flex-col gap-2 items-center text-[#94A3B8]">
                <button className="p-1.5 hover:text-[#0A1628]" aria-label="Bookmark"><Bookmark className="w-4 h-4" /></button>
                <button className="p-1.5 hover:text-[#0A1628]" aria-label="Share"><Share2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="prose-body" data-testid="post-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
              </div>
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-6">
                  {post.tags.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Answers */}
        <div className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-[#0A1628] mb-4" data-testid="answers-heading">
            {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
          </h2>
          {answers.length === 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]" data-testid="no-answers">
              No answers yet. Be the first to help — your experience is valuable here.
            </div>
          )}
          <div className="flex flex-col gap-4">
            {answers.map((ans) => (
              <div key={ans.id} className="bg-white border border-[#E2E8F0] rounded-lg p-6" data-testid={`answer-${ans.id}`}>
                {ans.is_accepted && (
                  <div className="flex items-center gap-2 bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 px-4 py-2.5 rounded-md text-sm font-medium mb-5">
                    <CheckCircle2 className="w-4 h-4" /> Accepted Answer
                  </div>
                )}
                <div className="flex gap-5">
                  <div className="hidden sm:block">
                    <VoteComponent
                      targetId={ans.id} targetType="answer"
                      initialCount={ans.vote_count}
                      initialVote={votes[ans.id] || 0}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Link to={`/profile/${ans.author?.username}`} className="font-medium text-sm text-[#0F172A] hover:text-[#0D9373]">
                        {ans.author?.full_name}
                      </Link>
                      <GroupBadge group={ans.author?.group_type} />
                      <span className="text-xs text-[#64748B] counter">{ans.author?.reputation_score} rep</span>
                      <span className="text-xs text-[#94A3B8]">· {timeAgo(ans.created_at)}</span>
                    </div>
                    <div className="prose-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ans.body}</ReactMarkdown>
                    </div>
                    {isAuthor && post.type === "question" && !post.is_solved && !ans.is_accepted && (
                      <button
                        onClick={() => acceptAnswer(ans.id)}
                        data-testid={`accept-${ans.id}`}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#16A34A] border border-[#16A34A]/30 hover:bg-[#16A34A]/5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept this answer
                      </button>
                    )}
                    {ans.comments?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-col gap-2">
                        {ans.comments.map((c) => (
                          <div key={c.id} className="text-xs text-[#475569]">
                            <Link to={`/profile/${c.author?.username}`} className="font-medium text-[#0F172A] hover:text-[#0D9373]">{c.author?.username}</Link>
                            <GroupBadge group={c.author?.group_type} />
                            <span className="ml-2">{c.body}</span>
                            <span className="ml-2 text-[#94A3B8]">· {timeAgo(c.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Answer composer */}
        <div className="mt-8 bg-white border border-[#E2E8F0] rounded-lg p-6">
          <h3 className="font-heading text-lg font-semibold text-[#0A1628] mb-3">Your answer</h3>
          {!user ? (
            <div className="text-sm text-[#64748B]">
              <Link to="/login" className="text-[#0D9373] hover:underline font-medium">Sign in</Link> to answer this question.
            </div>
          ) : (
            <form onSubmit={submitAnswer}>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Share your experience with this. Be specific — include what you tried, what worked, and what the outcome was."
                className="w-full min-h-[160px] p-3.5 border border-[#E2E8F0] rounded-md focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm font-mono leading-relaxed bg-white"
                data-testid="answer-textarea"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-[#94A3B8] counter">{newAnswer.length} characters {newAnswer.length < 50 && `(${50 - newAnswer.length} more needed)`}</div>
                <button
                  type="submit"
                  disabled={newAnswer.length < 50 || submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="answer-submit-btn"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Posting..." : "Post Answer"}
                </button>
              </div>
              <div className="mt-3 text-xs text-[#94A3B8]">
                Tip: use <code className="font-mono px-1 py-0.5 bg-[#F1F5F9] rounded">``` </code> for code blocks, **bold**, and bullet lists.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

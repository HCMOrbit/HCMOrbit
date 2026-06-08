import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Eye, CheckCircle2, ArrowUp } from "lucide-react";
import GroupBadge from "./GroupBadge";
import PostTypeBadge from "./PostTypeBadge";
import { timeAgo } from "../lib/api";

export default function PostCard({ post }) {
  const a = post.author || {};
  const sp = post.space || {};
  return (
    <article
      data-testid={`post-card-${post.id}`}
      className="bg-white border border-[#E2E8F0] p-5 rounded-lg hover:border-[#0D9373]/40 hover:shadow-sm transition-all"
    >
      <div className="flex gap-5">
        {/* Stats column */}
        <div className="hidden sm:flex flex-col items-end gap-3 text-sm text-[#64748B] min-w-[68px] pt-1">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 font-semibold text-[#0F172A]">
              <ArrowUp className="w-3.5 h-3.5" /> <span className="counter">{post.vote_count}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mt-0.5">votes</div>
          </div>
          <div className={`flex flex-col items-end ${post.is_solved ? "text-[#16A34A]" : ""}`}>
            <div className="flex items-center gap-1 font-semibold">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="counter">{post.answer_count}</span>
            </div>
            <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${post.is_solved ? "text-[#16A34A]" : "text-[#94A3B8]"}`}>
              {post.is_solved ? "solved" : "answers"}
            </div>
          </div>
          <div className="flex flex-col items-end text-[#94A3B8]">
            <div className="flex items-center gap-1 text-xs">
              <Eye className="w-3.5 h-3.5" /> <span className="counter">{post.view_count}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PostTypeBadge type={post.type} />
            {sp.name && (
              <Link to={`/community/spaces/${sp.slug}`} className="text-xs font-medium text-[#0D9373] hover:underline" data-testid={`space-link-${sp.slug}`}>
                {sp.name}
              </Link>
            )}
            {post.is_solved && (
              <span className="inline-flex items-center gap-1 text-xs text-[#16A34A] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Solved
              </span>
            )}
          </div>
          <Link to={`/community/posts/${post.id}`} className="block group" data-testid={`post-title-${post.id}`}>
            <h3 className="font-heading text-lg font-semibold text-[#0A1628] group-hover:text-[#0D9373] leading-snug">
              {post.title}
            </h3>
          </Link>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.tags.slice(0, 4).map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-[#64748B]">
            <Link to={`/profile/${a.username}`} className="font-medium text-[#0F172A] hover:text-[#0D9373]" data-testid={`author-link-${a.username}`}>
              {a.full_name}
            </Link>
            <GroupBadge group={a.group_type} />
            <span className="text-[#94A3B8]">·</span>
            <span className="counter">{a.reputation_score} rep</span>
            <span className="text-[#94A3B8]">·</span>
            <span>{timeAgo(post.created_at)}</span>
            {/* mobile stats */}
            <div className="sm:hidden ml-auto flex gap-2 text-[#64748B]">
              <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />{post.vote_count}</span>
              <span className={`flex items-center gap-1 ${post.is_solved ? "text-[#16A34A]" : ""}`}><MessageSquare className="w-3 h-3" />{post.answer_count}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

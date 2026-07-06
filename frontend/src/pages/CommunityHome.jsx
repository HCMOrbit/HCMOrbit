import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import PageHero from "../components/PageHero";
import CommunityLayout from "../components/CommunityLayout";
import PostCard from "../components/PostCard";
import { api } from "../lib/api";

const TABS = [
  { id: "all", label: "All", filter: {} },
  { id: "question", label: "Questions", filter: { type: "question" } },
  { id: "discussion", label: "Discussions", filter: { type: "discussion" } },
  { id: "success_story", label: "Success Stories", filter: { type: "success_story" } },
  { id: "unanswered", label: "Unanswered", filter: { unanswered: true } },
];

export default function CommunityHome() {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const tab = params.get("tab") || "all";
  const sort = params.get("sort") || "latest";

  useEffect(() => {
    setLoading(true);
    const tabDef = TABS.find((t) => t.id === tab) || TABS[0];
    const q = { sort, limit: 20, ...tabDef.filter };
    api.get("/posts", { params: q })
      .then((r) => setPosts(r.data.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [tab, sort]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="community-home">
      <NavHeader />
      <PageHero
        eyebrow="HCMOrbit Community"
        title="Community feed"
        description="Signal over noise. The best answers, not the most recent."
        maxWidth="1440px"
        testId="community-hero"
      />
      <CommunityLayout>
        {/* Tabs */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap" data-testid="feed-tabs">
          <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { params.set("tab", t.id); setParams(params); }}
                data-testid={`tab-${t.id}`}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-[#0A1628] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1">
            {[
              { id: "latest", label: "Latest" },
              { id: "top", label: "Top" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => { params.set("sort", s.id); setParams(params); }}
                data-testid={`sort-${s.id}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sort === s.id ? "bg-[#0D9373]/10 text-[#0D9373]" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div className="flex flex-col gap-3" data-testid="post-list">
          {loading ? (
            <div className="text-center py-16 text-sm text-[#94A3B8]">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center" data-testid="empty-state">
              <h3 className="font-heading font-semibold text-[#0A1628]">Nothing here yet.</h3>
              <p className="text-sm text-[#64748B] mt-1">Try a different filter or be the first to post.</p>
            </div>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </CommunityLayout>
    </div>
  );
}

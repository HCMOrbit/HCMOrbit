import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Briefcase, Linkedin, Calendar, Settings, BookOpen, Activity as ActivityIcon } from "lucide-react";
import NavHeader from "../components/NavHeader";
import GroupBadge from "../components/GroupBadge";
import PostCard from "../components/PostCard";
import { DocTypeBadge, DifficultyBadge, TYPE_BORDER } from "../components/kb/KBBadges";
import { api, timeAgo } from "../lib/api";
import { useAuth } from "../lib/auth";

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "kb", label: "KB Articles" },
  { id: "activity", label: "Activity" },
];

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [kbDocs, setKbDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/users/${username}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!data?.user) return;
    if (tab === "posts") {
      api.get(`/users/${username}/posts`).then((r) => setPosts(r.data)).catch(() => setPosts([]));
    } else if (tab === "kb") {
      api.get(`/kb/docs?author_id=${data.user.user_id}&limit=50`)
        .then((r) => setKbDocs(r.data.docs || []))
        .catch(() => setKbDocs([]));
    }
  }, [tab, username, data?.user]);

  if (loading) return <Shell><div className="text-center py-24 text-[#94A3B8]">Loading...</div></Shell>;
  if (!data) return <Shell><div className="text-center py-24 text-[#94A3B8]">User not found.</div></Shell>;

  const u = data.user;
  const stats = data.stats || {};
  const isOwner = me?.username === u.username;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="profile-page">
      <NavHeader />
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-8">
        {/* Profile header */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-7" data-testid="profile-header">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt={u.full_name} className="w-20 h-20 rounded-full object-cover shrink-0" data-testid="profile-avatar" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-3xl font-medium shrink-0" data-testid="profile-avatar">
                {(u.full_name || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-semibold text-[#1B3A6B]" data-testid="profile-name">{u.full_name}</h1>
              <div className="text-sm text-[#64748B]" data-testid="profile-username">@{u.username}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <GroupBadge group={u.group_type} size="lg" />
                <span className="text-sm font-semibold text-[#0F172A] counter">{u.reputation_score} reputation</span>
              </div>
              {u.bio && <p className="mt-4 text-sm text-[#475569] leading-relaxed max-w-2xl" data-testid="profile-bio">{u.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#64748B]">
                {u.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {u.location}</span>}
                {u.company_name && <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {u.company_name}</span>}
                {u.linkedin_url && <a href={u.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#0D9373]"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
                {u.created_at && <span className="inline-flex items-center gap-1" data-testid="profile-joined"><Calendar className="w-3.5 h-3.5" /> Joined {timeAgo(u.created_at)}</span>}
              </div>
              {u.workday_modules?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {u.workday_modules.map((m) => (
                    <span key={m} className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono">{m}</span>
                  ))}
                </div>
              )}
            </div>
            {isOwner ? (
              <Link
                to="/onboarding?edit=1"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#0D9373] text-[#0D9373] hover:bg-[#0D9373] hover:text-white text-sm font-medium transition-colors"
                data-testid="edit-profile-btn"
              >
                <Settings className="w-4 h-4" /> Edit profile
              </Link>
            ) : (
              <button
                className="px-4 py-2 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#94A3B8] cursor-not-allowed"
                disabled
                title="Follow system coming soon"
                data-testid="follow-btn"
              >
                Follow
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6" data-testid="profile-stats">
          <Stat label="Posts" value={stats.posts ?? 0} testid="stat-posts" />
          <Stat label="KB Articles" value={stats.kb_articles ?? 0} testid="stat-kb" />
          <Stat label="Followers" value={stats.followers ?? 0} testid="stat-followers" />
          <Stat label="Following" value={stats.following ?? 0} testid="stat-following" />
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1 w-fit" data-testid="profile-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-[#1B3A6B] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}
                data-testid={`profile-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-5" data-testid={`profile-tab-content-${tab}`}>
            {tab === "posts" && (
              posts.length === 0 ? (
                <EmptyState message={isOwner ? "You haven't posted anything yet." : `${u.full_name} hasn't posted anything yet.`} />
              ) : (
                <div className="flex flex-col gap-3">
                  {posts.map((p) => <PostCard key={p.id} post={p} />)}
                </div>
              )
            )}

            {tab === "kb" && (
              kbDocs.length === 0 ? (
                <EmptyState message={isOwner ? "You haven't published any KB articles yet." : `${u.full_name} hasn't published any KB articles.`} />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {kbDocs.map((d) => (
                    <Link
                      key={d.id}
                      to={`/knowledge-base/${d.category_slug}/${d.id}`}
                      className="bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0D9373] hover:shadow-sm transition-all"
                      style={{ borderLeftWidth: "3px", borderLeftColor: TYPE_BORDER(d.doc_type) }}
                      data-testid={`profile-kb-${d.id}`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <DocTypeBadge type={d.doc_type} />
                        <DifficultyBadge level={d.difficulty} />
                      </div>
                      <div className="font-heading font-semibold text-[#1B3A6B] leading-tight">{d.title}</div>
                      <div className="mt-1.5 text-xs text-[#64748B] line-clamp-2">{d.summary}</div>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-[#94A3B8]">
                        <span className="counter">{d.view_count || 0}</span> views
                        <span>·</span>
                        <span>{d.helpful_pct ?? 0}% helpful</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}

            {tab === "activity" && (
              <EmptyState message="Activity feed coming soon. We're working on a unified timeline of posts, answers, and KB contributions." icon={<ActivityIcon className="w-6 h-6 text-[#94A3B8] mx-auto mb-3" />} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <NavHeader />
      {children}
    </div>
  );
}

function Stat({ label, value, testid }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4" data-testid={testid}>
      <div className="font-heading text-2xl font-semibold text-[#1B3A6B] counter">{value || 0}</div>
      <div className="text-xs text-[#64748B] mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function EmptyState({ message, icon }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]">
      {icon}
      <div>{message}</div>
    </div>
  );
}

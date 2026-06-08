import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin, Briefcase, Linkedin, Calendar } from "lucide-react";
import NavHeader from "../components/NavHeader";
import GroupBadge from "../components/GroupBadge";
import PostCard from "../components/PostCard";
import { api, timeAgo } from "../lib/api";

const TABS = [
  { id: "question", label: "Questions" },
  { id: "answer", label: "Answers" },
  { id: "success_story", label: "Success Stories" },
];

export default function Profile() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("question");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/users/${username}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (tab === "answer") {
      setPosts([]);
      return;
    }
    api.get(`/users/${username}/posts?type=${tab}`).then((r) => setPosts(r.data));
  }, [tab, username]);

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><NavHeader /><div className="text-center py-24 text-[#94A3B8]">Loading...</div></div>;
  if (!data) return <div className="min-h-screen bg-[#F8FAFC]"><NavHeader /><div className="text-center py-24 text-[#94A3B8]">User not found.</div></div>;

  const u = data.user;
  const stats = data.stats;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="profile-page">
      <NavHeader />
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-8">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-7">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-3xl font-medium shrink-0">
              {(u.full_name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-semibold text-[#0A1628]" data-testid="profile-name">{u.full_name}</h1>
              <div className="text-sm text-[#64748B]">@{u.username}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <GroupBadge group={u.group_type} size="lg" />
                <span className="text-sm font-semibold text-[#0F172A] counter">{u.reputation_score} reputation</span>
              </div>
              {u.bio && <p className="mt-4 text-sm text-[#475569] leading-relaxed max-w-2xl">{u.bio}</p>}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#64748B]">
                {u.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {u.location}</span>}
                {u.company_name && <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {u.company_name}</span>}
                {u.linkedin_url && <a href={u.linkedin_url} className="inline-flex items-center gap-1 hover:text-[#0D9373]"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>}
                {u.created_at && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {timeAgo(u.created_at)}</span>}
              </div>
              {u.workday_modules?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {u.workday_modules.map((m) => (
                    <span key={m} className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono">{m}</span>
                  ))}
                </div>
              )}
            </div>
            <button className="px-4 py-2 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#94A3B8] cursor-not-allowed" disabled title="Coming soon" data-testid="follow-btn">
              Follow
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Stat label="Questions" value={stats.questions} />
          <Stat label="Answers" value={stats.answers} />
          <Stat label="Accepted" value={stats.accepted} />
          <Stat label="Reputation" value={u.reputation_score} />
        </div>

        <div className="mt-8">
          <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-[#0A1628] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}
                data-testid={`profile-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 mt-5">
            {tab === "answer" ? (
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]">
                Answer activity coming soon. View questions and success stories tabs to see this user's posts.
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-sm text-[#64748B]">
                No {tab.replace("_", " ")}s yet.
              </div>
            ) : posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
      <div className="font-heading text-2xl font-semibold text-[#0A1628] counter">{value || 0}</div>
      <div className="text-xs text-[#64748B] mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

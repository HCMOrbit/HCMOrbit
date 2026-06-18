import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, FileText, TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import AdminLayout from "../../components/AdminLayout";
import GroupBadge from "../../components/GroupBadge";
import { api, timeAgo, formatApiError } from "../../lib/api";

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-[#64748B] font-semibold">{label}</div>
        <div className="w-8 h-8 rounded bg-[#0D9373]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#0D9373]" />
        </div>
      </div>
      <div className="mt-3 font-heading text-3xl font-bold text-[#0A1628] counter">{value}</div>
      {hint && <div className="text-xs text-[#94A3B8] mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [chart, setChart] = useState([]);
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const refreshEcosystemNews = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post("/admin/ecosystem/refresh-news");
      const n = data?.new ?? 0;
      const pruned = data?.pruned ?? 0;
      const failures = data?.failures || [];
      const msg = n === 0
        ? "No new ecosystem news — feed is up to date."
        : `Fetched ${n} new ${n === 1 ? "item" : "items"}${pruned ? `, pruned ${pruned}` : ""}.`;
      if (failures.length) toast.warning(`${msg} (Source issues: ${failures.join(", ")})`);
      else toast.success(msg);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {}),
      api.get("/admin/recent-members").then((r) => setMembers(r.data)).catch(() => {}),
      api.get("/admin/recent-posts").then((r) => setPosts(r.data)).catch(() => {}),
      api.get("/admin/signup-chart?days=30").then((r) => setChart(r.data)).catch(() => {}),
      api.get("/admin/logs?limit=20").then((r) => setLogs(r.data)).catch(() => {}),
    ]);
  }, []);

  return (
    <AdminLayout pendingReports={stats.pending_reports || 0}>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628]" data-testid="admin-dashboard-title">Admin overview</h1>
          <p className="text-sm text-[#64748B] mt-1">Pulse of the HCMOrbit community.</p>
        </div>
        <button
          onClick={refreshEcosystemNews}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#E2E8F0] bg-white text-sm font-medium text-[#0A1628] hover:border-[#0D9373] hover:text-[#0D9373] disabled:opacity-50 transition-colors"
          data-testid="admin-refresh-ecosystem-news-btn"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh ecosystem news"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total members" value={stats.total_members ?? 0} />
        <StatCard icon={TrendingUp} label="New this week" value={stats.new_members_week ?? 0} />
        <StatCard icon={FileText} label="Total posts" value={stats.total_posts ?? 0} />
        <StatCard icon={Calendar} label="Posts this week" value={stats.posts_week ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <h2 className="font-heading font-semibold text-[#0A1628]">Recent members</h2>
          <div className="mt-4 flex flex-col">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 py-2.5 border-b border-[#F1F5F9] last:border-0" data-testid={`recent-member-${m.username}`}>
                <div className="w-8 h-8 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-xs font-medium">
                  {(m.full_name || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#0F172A] truncate">{m.full_name}</div>
                  <div className="text-xs text-[#94A3B8] truncate">{timeAgo(m.created_at)}</div>
                </div>
                <GroupBadge group={m.group_type} />
                <Link to={`/profile/${m.username}`} target="_blank" className="text-xs text-[#0D9373] hover:underline whitespace-nowrap">View</Link>
              </div>
            ))}
            {members.length === 0 && <div className="text-sm text-[#94A3B8] py-4 text-center">No members yet.</div>}
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <h2 className="font-heading font-semibold text-[#0A1628]">Recent posts</h2>
          <div className="mt-4 flex flex-col">
            {posts.map((p) => (
              <Link key={p.id} to={`/community/posts/${p.id}`} className="block py-2.5 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] -mx-2 px-2 rounded" data-testid={`recent-post-${p.id}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
                  <span className="text-[#1D6FE8]">{p.type?.replace("_", " ")}</span>
                  <span className="text-[#94A3B8]">·</span>
                  <span className="text-[#0D9373]">{p.space?.name}</span>
                </div>
                <div className="text-sm font-medium text-[#0F172A] mt-1 line-clamp-1">{p.title}</div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{p.author?.full_name} · {timeAgo(p.created_at)} · {p.vote_count} votes</div>
              </Link>
            ))}
            {posts.length === 0 && <div className="text-sm text-[#94A3B8] py-4 text-center">No posts yet.</div>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 mb-8" data-testid="signup-chart">
        <h2 className="font-heading font-semibold text-[#0A1628]">Signups · last 30 days</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} interval={Math.max(0, Math.floor(chart.length / 8) - 1)} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "#0D937310" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#E2E8F0" }} />
              <Bar dataKey="count" fill="#0D9373" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5" data-testid="admin-logs">
        <h2 className="font-heading font-semibold text-[#0A1628]">Recent admin actions</h2>
        <div className="mt-4 max-h-72 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-sm text-[#94A3B8] text-center py-6">No admin actions yet.</div>
          ) : logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 py-2.5 border-b border-[#F1F5F9] last:border-0 text-sm">
              <span className="text-xs text-[#94A3B8] w-24 shrink-0 mt-0.5">{timeAgo(l.created_at)}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">{l.action}</span>
              {l.note && <span className="text-[#475569] truncate">{l.note}</span>}
              <span className="ml-auto text-xs text-[#94A3B8]">@{l.admin_username}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

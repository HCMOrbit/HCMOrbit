import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users, Network, Shield, BarChart3, Wallet, Landmark, Home, Bookmark, FileQuestion, MessageCircle,
  Target, Sprout, Briefcase, Clock, GraduationCap, LineChart, ShoppingCart, Ruler, Map, Bot, Factory,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import GroupBadge from "./GroupBadge";

const ICON_MAP = {
  Users, Network, Shield, BarChart3, Wallet, Landmark,
  Target, Sprout, Briefcase, Clock, GraduationCap, LineChart, ShoppingCart, Ruler, Map, Bot, Factory,
};

export default function CommunityLayout({ children, rightSidebar = true }) {
  const [spaces, setSpaces] = useState([]);
  const [topContrib, setTopContrib] = useState([]);
  const [tags, setTags] = useState([]);
  const [showAllSpaces, setShowAllSpaces] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    api.get("/spaces").then((r) => setSpaces(r.data)).catch(() => {});
    if (rightSidebar) {
      api.get("/community/top-contributors").then((r) => setTopContrib(r.data)).catch(() => {});
      api.get("/community/tags").then((r) => setTags(r.data)).catch(() => {});
    }
  }, [rightSidebar]);

  // Populated first (by post count desc), then empty in canonical order
  const populated = spaces
    .filter((s) => (s.post_count || 0) > 0)
    .sort((a, b) => (b.post_count || 0) - (a.post_count || 0) || (a.sort_order || 99) - (b.sort_order || 99));
  const empty = spaces
    .filter((s) => (s.post_count || 0) === 0)
    .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
  const visible = showAllSpaces ? [...populated, ...empty] : populated;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 flex gap-6">
      {/* Left sidebar */}
      <aside className="w-60 shrink-0 hidden lg:flex flex-col gap-6 sticky top-20 self-start" data-testid="left-sidebar">
        {user && (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4" data-testid="user-mini-card">
            <Link to={`/profile/${user.username}`} className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-base font-medium">
                {(user.full_name || "U")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm text-[#0F172A] truncate">{user.full_name}</div>
                <div className="text-xs text-[#64748B] truncate">@{user.username}</div>
              </div>
            </Link>
            <div className="flex items-center justify-between text-xs">
              <GroupBadge group={user.group_type} />
              <span className="text-[#64748B] counter font-medium">{user.reputation_score} rep</span>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-0.5 text-sm">
          <SideLink to="/community" icon={Home} active={location.pathname === "/community"}>Home feed</SideLink>
          {user && <SideLink to={`/profile/${user.username}`} icon={FileQuestion}>My posts</SideLink>}
          {user && <SideLink to="/bookmarks" icon={Bookmark} active={location.pathname === "/bookmarks"}>Bookmarks</SideLink>}
          <SideLink to="/notifications" icon={MessageCircle}>Notifications</SideLink>
        </nav>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold mb-2 px-3">Spaces</div>
          <nav className="flex flex-col gap-0.5">
            {visible.map((s) => {
              const Icon = ICON_MAP[s.icon] || Users;
              const active = location.pathname === `/community/spaces/${s.slug}`;
              const isEmpty = (s.post_count || 0) === 0;
              return (
                <Link
                  key={s.slug}
                  to={`/community/spaces/${s.slug}`}
                  data-testid={`sidebar-space-${s.slug}`}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded text-sm transition-colors ${active ? "bg-[#0D9373]/10 text-[#0D9373]" : isEmpty ? "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]" : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0A1628]"}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="text-xs text-[#94A3B8] counter">{s.post_count}</span>
                </Link>
              );
            })}
            {empty.length > 0 && (
              <button
                onClick={() => setShowAllSpaces((v) => !v)}
                data-testid="sidebar-show-more-spaces"
                aria-expanded={showAllSpaces}
                className="mt-1 px-3 py-1.5 text-left text-xs font-medium text-[#0D9373] hover:bg-[#F1F5F9] rounded transition-colors"
              >
                {showAllSpaces ? `Show fewer (${populated.length})` : `Show more spaces (${empty.length} empty)`}
              </button>
            )}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">{children}</main>

      {/* Right sidebar */}
      {rightSidebar && (
        <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-5 sticky top-20 self-start" data-testid="right-sidebar">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
            <div className="font-heading font-semibold text-sm text-[#0A1628] mb-3">Top contributors this week</div>
            <div className="flex flex-col gap-3">
              {topContrib.map((u, idx) => (
                <Link key={u.user_id} to={`/profile/${u.username}`} className="flex items-center gap-3 group">
                  <span className="text-[#94A3B8] text-xs font-medium w-4">{idx + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-xs font-medium">
                    {(u.full_name || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#0F172A] group-hover:text-[#0D9373] truncate">{u.full_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <GroupBadge group={u.group_type} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] counter">{u.reputation_score}</span>
                </Link>
              ))}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
              <div className="font-heading font-semibold text-sm text-[#0A1628] mb-3">Popular tags</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 14).map((t) => (
                  <span key={t.tag} className="text-[11px] px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono">
                    {t.tag} <span className="text-[#94A3B8]">·{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function SideLink({ to, icon: Icon, active, children }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${active ? "bg-[#0A1628] text-white" : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0A1628]"}`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

import React, { useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Flag, Layers, Settings as SettingsIcon, ShieldCheck, ArrowLeft, BookOpen } from "lucide-react";
import NavHeader from "./NavHeader";
import { useAuth } from "../lib/auth";

export default function AdminLayout({ children, pendingReports = 0 }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    if (!user.is_admin) navigate("/community");
  }, [user, authLoading, navigate]);

  if (authLoading || !user || !user.is_admin) {
    return <div className="min-h-screen bg-[#F8FAFC]" />;
  }

  const items = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/members", label: "Members", icon: Users },
    { to: "/admin/posts", label: "Posts", icon: FileText },
    { to: "/admin/reported", label: "Reported Content", icon: Flag, badge: pendingReports },
    { to: "/admin/spaces", label: "Spaces", icon: Layers },
    { to: "/admin/knowledge-base", label: "Knowledge Base", icon: BookOpen },
    { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="admin-layout">
      <NavHeader />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 flex gap-6">
        <aside className="w-60 shrink-0 hidden lg:flex flex-col gap-1 sticky top-20 self-start" data-testid="admin-sidebar">
          <div className="px-3 mb-3 flex items-center gap-2 text-xs font-semibold text-[#0A1628]">
            <ShieldCheck className="w-4 h-4 text-[#0D9373]" />
            <span className="uppercase tracking-wider">Admin</span>
          </div>
          {items.map((it) => {
            const Icon = it.icon;
            const active = it.exact ? location.pathname === it.to : location.pathname.startsWith(it.to);
            return (
              <NavLink
                key={it.to} to={it.to}
                end={it.exact}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded text-sm transition-colors ${active ? "bg-[#0A1628] text-white" : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0A1628]"}`}
                data-testid={`admin-nav-${it.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {it.label}
                </span>
                {it.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#DC2626] text-white text-[10px] font-semibold flex items-center justify-center counter">
                    {it.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
          <Link to="/community" className="mt-4 px-3 py-2 rounded text-xs text-[#94A3B8] hover:text-[#0A1628] flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to community
          </Link>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

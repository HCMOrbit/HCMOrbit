import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Bell, PlusCircle, LogOut, User, Settings, ChevronDown, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import GroupBadge from "./GroupBadge";

function AboutMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref} data-testid="nav-about">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0A1628] transition-colors"
        data-testid="nav-about-trigger"
        aria-expanded={open}
      >
        About <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-40 overflow-hidden" data-testid="nav-about-menu">
          <Link
            to="/why-hcmorbit"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC]"
            data-testid="nav-about-why"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Why HCMOrbit Exists</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">Our story and why we built this community.</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function NavHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch unread count when logged in, refresh on route change
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let cancelled = false;
    api.get("/notifications")
      .then((r) => { if (!cancelled) setUnread(r.data.unread || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, location.pathname]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]" data-testid="nav-header">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
          <div className="w-8 h-8 rounded-md bg-[#0A1628] flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#0D9373]" />
          </div>
          <span className="font-heading font-bold text-lg text-[#0A1628] tracking-tight">HCMOrbit</span>
        </Link>

        {user ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" data-testid="nav-main">
            <NavLink to="/community" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-home">
              Home
            </NavLink>
            <NavLink to="/knowledge-base" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-kb">
              Knowledge Base
            </NavLink>
            <NavLink to="/notifications" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-notifications">
              Notifications
            </NavLink>
            <AboutMenu />
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" data-testid="nav-main-guest">
            <NavLink to="/knowledge-base" className="text-[#64748B] hover:text-[#0A1628]" data-testid="nav-kb-guest">
              Knowledge Base
            </NavLink>
            <AboutMenu />
          </nav>
        )}

        {/* Search */}
        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md mx-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search posts, tags..."
            data-testid="header-search-input"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#F1F5F9] border border-transparent rounded-md focus:bg-white focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none"
          />
        </form>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/community/new-post" className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium transition-colors" data-testid="new-post-btn">
                <PlusCircle className="w-4 h-4" />
                New Post
              </Link>
              {user.is_admin && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-xs font-semibold uppercase tracking-wider"
                  data-testid="admin-link"
                  title="Admin dashboard"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
              <Link to="/notifications" className="relative p-2 hover:bg-[#F1F5F9] rounded-md text-[#64748B]" aria-label="Notifications" data-testid="bell-icon">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-semibold flex items-center justify-center counter" data-testid="bell-unread-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1 hover:bg-[#F1F5F9] rounded-md"
                  data-testid="user-menu-button"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-sm font-medium">
                    {(user.full_name || user.username || "U")[0].toUpperCase()}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-40 overflow-hidden" data-testid="user-menu-dropdown">
                      <div className="px-4 py-3 border-b border-[#E2E8F0]">
                        <div className="font-medium text-sm text-[#0F172A]">{user.full_name}</div>
                        <div className="text-xs text-[#64748B]">@{user.username}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <GroupBadge group={user.group_type} />
                          <span className="text-xs text-[#64748B] counter">{user.reputation_score} rep</span>
                        </div>
                      </div>
                      <button onClick={() => { setMenuOpen(false); navigate(`/profile/${user.username}`); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#0F172A] hover:bg-[#F8FAFC]" data-testid="menu-profile">
                        <User className="w-4 h-4" /> Profile
                      </button>
                      <button onClick={() => { setMenuOpen(false); logout(); navigate("/"); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2]" data-testid="menu-logout">
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3.5 py-2 text-sm text-[#0A1628] hover:text-[#0D9373]" data-testid="signin-btn">
                Sign In
              </Link>
              <Link to="/register" className="px-3.5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium" data-testid="join-btn">
                Join Community
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

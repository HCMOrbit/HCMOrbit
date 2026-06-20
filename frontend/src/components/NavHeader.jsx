import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Bell, PlusCircle, LogOut, User, ChevronDown, Search, ShieldCheck, Sparkles, UserRound, X, MessageSquare } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import GroupBadge from "./GroupBadge";

// -- Brand mark (logo square + wordmark) --------------------------------------
function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-3 group shrink-0" data-testid="logo-link">
      <div className="w-11 h-11 rounded-lg bg-[#0A1628] shadow-sm" />
      <span className="font-heading font-extrabold text-2xl tracking-tight whitespace-nowrap">
        <span className="text-[#0A1628]">HCM</span>
        <span className="text-[#0D9373]">Orbit</span>
      </span>
    </Link>
  );
}

// -- Active-aware nav link with teal underline -------------------------------
function NavItem({ to, label, hasCaret = false, testid }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      data-testid={testid}
      className={({ isActive }) =>
        `relative inline-flex items-center gap-1 py-2 text-[15px] font-bold whitespace-nowrap transition-colors ${
          isActive ? "text-[#0A1628]" : "text-[#0A1628]/80 hover:text-[#0A1628]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span>{label}</span>
          {hasCaret && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
          <span
            aria-hidden
            className={`pointer-events-none absolute left-0 right-0 -bottom-[14px] h-[3px] rounded-full bg-[#0D9373] transition-opacity ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}
    </NavLink>
  );
}

// -- About dropdown menu ------------------------------------------------------
function AboutMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  const isActive =
    location.pathname.startsWith("/why-hcmorbit") ||
    location.pathname.startsWith("/about") ||
    location.pathname.startsWith("/connect");

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
        className={`relative inline-flex items-center gap-1 py-2 text-[15px] font-bold whitespace-nowrap transition-colors ${isActive ? "text-[#0A1628]" : "text-[#0A1628]/80 hover:text-[#0A1628]"}`}
        data-testid="nav-about-trigger"
        aria-expanded={open}
      >
        About <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
        <span aria-hidden className={`pointer-events-none absolute left-0 right-0 -bottom-[14px] h-[3px] rounded-full bg-[#0D9373] transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-4 w-72 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-40 overflow-hidden" data-testid="nav-about-menu">
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
          <Link
            to="/why-hcmorbit#founder"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-t border-[#F1F5F9]"
            data-testid="nav-about-founder"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <UserRound className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Meet the Founder</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">17+ years in HR tech — the story behind HCMOrbit.</div>
            </div>
          </Link>
          <Link
            to="/connect"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-t border-[#F1F5F9]"
            data-testid="nav-about-connect"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Connect</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">Partnerships, press, or just say hello.</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

// -- Full-screen search overlay ----------------------------------------------
function SearchOverlay({ open, onClose }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A1628]/70 backdrop-blur-sm" onClick={onClose} data-testid="search-overlay">
      <div className="max-w-2xl mx-auto mt-24 px-4" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <Search className="w-5 h-5 text-[#94A3B8]" />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts, tags, knowledge base..."
              className="flex-1 text-base bg-transparent outline-none placeholder:text-[#94A3B8]"
              data-testid="search-overlay-input"
            />
            <button type="button" onClick={onClose} className="p-1.5 text-[#64748B] hover:text-[#0A1628] rounded-md hover:bg-[#F1F5F9]" data-testid="search-overlay-close" aria-label="Close search">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-xs text-[#64748B] flex items-center justify-between">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] font-mono text-[10px]">Enter</kbd> to search</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E2E8F0] font-mono text-[10px]">Esc</kbd> to close</span>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main header --------------------------------------------------------------
export default function NavHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let cancelled = false;
    api.get("/notifications")
      .then((r) => { if (!cancelled) setUnread(r.data.unread || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, location.pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]" data-testid="nav-header">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-20 flex items-center justify-between gap-6">
          <BrandMark />

          {/* Center navigation */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7" data-testid={user ? "nav-main" : "nav-main-guest"}>
            {user && <NavItem to="/community" label="Community" testid="nav-home" />}
            <NavItem to="/knowledge-base" label="Knowledge Base" hasCaret testid="nav-kb" />
            <NavItem to="/career-hub" label="Career Hub" testid="nav-career" />
            <NavItem to="/ecosystem" label="Ecosystem" hasCaret testid="nav-ecosystem" />
            <AboutMenu />
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2.5 rounded-full text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9] transition-colors"
              aria-label="Search"
              data-testid="header-search-button"
            >
              <Search className="w-5 h-5" />
            </button>

            {user ? (
              <>
                <Link to="/community/new-post" className="hidden xl:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold transition-colors shadow-sm" data-testid="new-post-btn">
                  <PlusCircle className="w-4 h-4" />
                  New Post
                </Link>
                <Link to="/community/new-post" className="lg:inline-flex xl:hidden hidden items-center justify-center w-10 h-10 rounded-full bg-[#0D9373] hover:bg-[#0b7c61] text-white shadow-sm" data-testid="new-post-btn-icon" title="New post">
                  <PlusCircle className="w-4 h-4" />
                </Link>
                {user.is_admin && (
                  <Link
                    to="/admin"
                    className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-xs font-semibold uppercase tracking-wider"
                    data-testid="admin-link"
                    title="Admin dashboard"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </Link>
                )}
                <Link to="/notifications" className="relative p-2.5 hover:bg-[#F1F5F9] rounded-full text-[#475569] hover:text-[#0A1628] transition-colors" aria-label="Notifications" data-testid="bell-icon">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-semibold flex items-center justify-center counter" data-testid="bell-unread-count">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-1.5 p-0.5 pr-1 rounded-full hover:bg-[#F1F5F9] transition-colors"
                    data-testid="user-menu-button"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-sm font-semibold ring-2 ring-white shadow-sm">
                      {(user.full_name || user.username || "U")[0].toUpperCase()}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 mt-3 w-64 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-40 overflow-hidden" data-testid="user-menu-dropdown">
                        <div className="px-4 py-3 border-b border-[#E2E8F0]">
                          <div className="font-semibold text-sm text-[#0F172A]">{user.full_name}</div>
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
                <Link to="/login" className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-[#0A1628] hover:text-[#0D9373] transition-colors" data-testid="signin-btn">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-5 py-2.5 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold transition-colors shadow-sm"
                  data-testid="join-btn"
                >
                  Join Community
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

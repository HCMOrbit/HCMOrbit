import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Bell, PlusCircle, LogOut, User, ChevronDown, Search, ShieldCheck, Sparkles, UserRound, X, MessageSquare, TrendingUp, Calendar, Menu } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import GroupBadge from "./GroupBadge";

// -- Brand mark (logo square with teal orbit + wordmark) ----------------------
function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-3 group shrink-0" data-testid="logo-link">
      <div className="w-11 h-11 rounded-lg bg-[#0A1628] flex items-center justify-center shadow-sm">
        <div className="w-4 h-4 rounded-full bg-[#0D9373]" />
      </div>
      <span className="font-heading font-extrabold text-[28px] tracking-tight whitespace-nowrap leading-none">
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

// -- Ecosystem dropdown menu --------------------------------------------------
function EcosystemMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  // Community lives under Ecosystem now — highlight this nav item on any
  // /community* route as well as the ecosystem routes.
  const isActive =
    location.pathname.startsWith("/ecosystem") ||
    location.pathname === "/community" ||
    location.pathname.startsWith("/community/");

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref} data-testid="nav-ecosystem">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center gap-1 py-2 text-[15px] font-bold whitespace-nowrap transition-colors ${isActive ? "text-[#0A1628]" : "text-[#0A1628]/80 hover:text-[#0A1628]"}`}
        data-testid="nav-ecosystem-trigger"
        aria-expanded={open}
      >
        Ecosystem <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
        <span aria-hidden className={`pointer-events-none absolute left-0 right-0 -bottom-[14px] h-[3px] rounded-full bg-[#0D9373] transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-4 w-72 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-40 overflow-hidden" data-testid="nav-ecosystem-menu">
          <Link
            to="/ecosystem/industry-pulse"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC]"
            data-testid="nav-ecosystem-industry"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Industry Pulse</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">Demand signals, hot modules, and recent go-lives.</div>
            </div>
          </Link>
          <Link
            to="/community"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-t border-[#F1F5F9]"
            data-testid="nav-ecosystem-community"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Community</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">Threaded Q&amp;A across every Workday module.</div>
            </div>
          </Link>
          <Link
            to="/ecosystem/upcoming-events"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-t border-[#F1F5F9]"
            data-testid="nav-ecosystem-events"
          >
            <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0A1628]">Upcoming Events</div>
              <div className="text-xs text-[#64748B] mt-0.5 leading-snug">RUGs, conferences, and webinars worth attending.</div>
            </div>
          </Link>
        </div>
      )}
    </div>
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

// -- Mobile drawer ────────────────────────────────────────────────────────────
// Slides in from the right. Mirrors the desktop nav structure 1:1 — Career
// Hub / Knowledge Base / Docwright / Ecosystem (accordion) / About (accordion),
// plus Search and auth actions. Never introduces new items.
function MobileDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const triggerReturnRef = useRef(null);
  const [ecoOpen, setEcoOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Preserve the element that opened the drawer so we can restore focus on close.
  useEffect(() => {
    if (open) triggerReturnRef.current = document.activeElement;
  }, [open]);

  // Close on route change — compare with previous pathname via a ref so
  // opening the drawer doesn't re-trigger this effect and close it instantly.
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      if (open) onClose();
    }
  }, [location.pathname, open, onClose]);

  // Body scroll lock, Esc close, focus management, focus trap.
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the close button when opening.
    setTimeout(() => closeBtnRef.current?.focus(), 40);

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger.
      const t = triggerReturnRef.current;
      if (t && typeof t.focus === "function") t.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isCommunityRoute =
    location.pathname === "/community" || location.pathname.startsWith("/community/");
  const isEcosystemActive = location.pathname.startsWith("/ecosystem") || isCommunityRoute;
  const isAboutActive =
    location.pathname.startsWith("/why-hcmorbit") ||
    location.pathname.startsWith("/about") ||
    location.pathname.startsWith("/connect");

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      data-testid="mobile-drawer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-[2px] animate-[fadeIn_140ms_ease-out]"
        onClick={onClose}
        data-testid="mobile-drawer-backdrop"
      />
      {/* Panel */}
      <aside
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-[86%] max-w-[380px] bg-white shadow-2xl flex flex-col animate-[slideInR_180ms_ease-out]"
        data-testid="mobile-drawer-panel"
      >
        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>

        <div className="h-20 px-4 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
          <span className="font-heading font-extrabold text-lg tracking-tight">
            <span className="text-[#0A1628]">HCM</span><span className="text-[#0D9373]">Orbit</span>
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            data-testid="mobile-drawer-close"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" data-testid="mobile-drawer-nav">
          <DrawerLink to="/career-hub" label="Career Hub" testid="mobile-nav-career" onNavigate={onClose} />
          <DrawerLink to="/knowledge-base" label="Knowledge Base" testid="mobile-nav-kb" onNavigate={onClose} />
          <DrawerLink to="/docwright" label="Docwright" testid="mobile-nav-docwright" onNavigate={onClose} />

          {/* Ecosystem accordion */}
          <DrawerAccordion
            label="Ecosystem"
            open={ecoOpen}
            active={isEcosystemActive}
            onToggle={() => setEcoOpen((v) => !v)}
            testid="mobile-nav-ecosystem"
          >
            <DrawerSubLink to="/ecosystem/industry-pulse" icon={TrendingUp}
                          title="Industry Pulse" subtitle="Demand signals & hot modules."
                          testid="mobile-nav-ecosystem-industry" onNavigate={onClose} />
            <DrawerSubLink to="/community" icon={MessageSquare}
                          title="Community" subtitle="Threaded Q&A across every Workday module."
                          testid="mobile-nav-ecosystem-community" onNavigate={onClose} />
            <DrawerSubLink to="/ecosystem/upcoming-events" icon={Calendar}
                          title="Upcoming Events" subtitle="RUGs, conferences, and webinars."
                          testid="mobile-nav-ecosystem-events" onNavigate={onClose} />
          </DrawerAccordion>

          {/* About accordion */}
          <DrawerAccordion
            label="About"
            open={aboutOpen}
            active={isAboutActive}
            onToggle={() => setAboutOpen((v) => !v)}
            testid="mobile-nav-about"
          >
            <DrawerSubLink to="/why-hcmorbit" icon={Sparkles}
                          title="Why HCMOrbit Exists" subtitle="Our story."
                          testid="mobile-nav-about-why" onNavigate={onClose} />
            <DrawerSubLink to="/why-hcmorbit#founder" icon={UserRound}
                          title="Meet the Founder" subtitle="17+ years in HR tech."
                          testid="mobile-nav-about-founder" onNavigate={onClose} />
            <DrawerSubLink to="/connect" icon={MessageSquare}
                          title="Connect" subtitle="Partnerships, press, or say hello."
                          testid="mobile-nav-about-connect" onNavigate={onClose} />
          </DrawerAccordion>

          {/* Search — mirrors the header icon so it's reachable from the drawer too */}
          <button
            type="button"
            onClick={() => { onClose(); setTimeout(() => document.querySelector('[data-testid="header-search-button"]')?.click(), 60); }}
            className="mt-2 w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] font-semibold text-[#0A1628] hover:bg-[#F1F5F9]"
            data-testid="mobile-nav-search"
          >
            <Search className="w-4 h-4 text-[#475569]" /> Search
          </button>
        </nav>

        {/* Auth block pinned to the bottom */}
        <div className="border-t border-[#E2E8F0] p-4 shrink-0">
          {user ? (
            <div className="space-y-2" data-testid="mobile-drawer-user-actions">
              <div className="flex items-center gap-3 px-1 py-2">
                <div className="w-10 h-10 rounded-full bg-[#0A1628] text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {(user.full_name || user.username || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#0F172A] truncate">{user.full_name}</div>
                  <div className="text-xs text-[#64748B] truncate">@{user.username}</div>
                </div>
              </div>
              <Link to="/community/new-post" onClick={onClose}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold"
                    data-testid="mobile-nav-new-post">
                <PlusCircle className="w-4 h-4" /> New Post
              </Link>
              {user.is_admin && (
                <Link to="/admin" onClick={onClose}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-xs font-semibold uppercase tracking-wider"
                      data-testid="mobile-nav-admin">
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
              <Link to={`/profile/${user.username}`} onClick={onClose}
                    className="w-full min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                    data-testid="mobile-nav-profile">
                <User className="w-4 h-4" /> Profile
              </Link>
              <button type="button"
                      onClick={() => { onClose(); logout(); navigate("/"); }}
                      className="w-full min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#DC2626] hover:bg-[#FEF2F2]"
                      data-testid="mobile-nav-signout">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" data-testid="mobile-drawer-guest-actions">
              <Link to="/login" onClick={onClose}
                    className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-[#0A1628] border border-[#E2E8F0] hover:border-[#0D9373] rounded-full"
                    data-testid="mobile-nav-signin">
                Sign In
              </Link>
              <Link to="/register" onClick={onClose}
                    className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold"
                    data-testid="mobile-nav-join">
                Join Community
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DrawerLink({ to, label, testid, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      data-testid={testid}
      className={({ isActive }) =>
        `w-full min-h-[44px] flex items-center px-3 py-2.5 rounded-md text-[15px] font-semibold transition-colors ${
          isActive
            ? "text-[#0A1628] bg-[#0D9373]/10 border-l-[3px] border-[#0D9373] pl-[9px]"
            : "text-[#0A1628]/85 hover:bg-[#F1F5F9]"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function DrawerAccordion({ label, open, active, onToggle, testid, children }) {
  return (
    <div data-testid={`${testid}-section`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={`${testid}-toggle`}
        className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-md text-[15px] font-semibold transition-colors ${
          active
            ? "text-[#0A1628] bg-[#0D9373]/10 border-l-[3px] border-[#0D9373] pl-[9px]"
            : "text-[#0A1628]/85 hover:bg-[#F1F5F9]"
        }`}
      >
        <span>{label}</span>
        <ChevronDown className={`w-4 h-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pl-2 mt-1 mb-2 space-y-1" data-testid={`${testid}-panel`}>
          {children}
        </div>
      )}
    </div>
  );
}

function DrawerSubLink({ to, icon: Icon, title, subtitle, testid, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      data-testid={testid}
      className={({ isActive }) =>
        `w-full min-h-[44px] flex items-start gap-3 px-3 py-2 rounded-md transition-colors ${
          isActive ? "bg-[#0D9373]/10" : "hover:bg-[#F1F5F9]"
        }`
      }
    >
      <div className="w-8 h-8 rounded-md bg-[#0D9373]/10 text-[#0D9373] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#0A1628]">{title}</div>
        <div className="text-xs text-[#64748B] mt-0.5 leading-snug">{subtitle}</div>
      </div>
    </NavLink>
  );
}

// -- Main header --------------------------------------------------------------
export default function NavHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
        <div className="max-w-[1440px] mx-auto px-4 xl:px-8 h-20 flex items-center justify-between gap-4 xl:gap-6">
          <BrandMark />

          {/* Center navigation */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-7" data-testid={user ? "nav-main" : "nav-main-guest"}>
            <NavItem to="/career-hub" label="Career Hub" testid="nav-career" />
            <NavItem to="/knowledge-base" label="Knowledge Base" hasCaret testid="nav-kb" />
            <NavItem to="/docwright" label="Docwright" testid="nav-docwright" />
            <EcosystemMenu />
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
                <Link to="/login" className="hidden lg:inline-flex items-center px-4 py-2 text-sm font-medium text-[#0A1628] hover:text-[#0D9373] transition-colors" data-testid="signin-btn">
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="hidden lg:inline-flex items-center px-5 py-2.5 rounded-full bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-semibold transition-colors shadow-sm"
                  data-testid="join-btn"
                >
                  Join Community
                </Link>
              </>
            )}

            {/* Hamburger — visible only below lg, where the desktop nav is hidden */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer-panel"
              data-testid="nav-hamburger"
              className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

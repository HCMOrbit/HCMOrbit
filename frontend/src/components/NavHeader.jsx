import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, PlusCircle, LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "../lib/auth";
import GroupBadge from "./GroupBadge";

export default function NavHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0]" data-testid="nav-header">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
          <div className="w-8 h-8 rounded-md bg-[#0A1628] flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#0D9373]" />
          </div>
          <span className="font-heading font-bold text-lg text-[#0A1628] tracking-tight">HCMOrbit</span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" data-testid="nav-main">
            <NavLink to="/community" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-home">
              Home
            </NavLink>
            <NavLink to="/community/spaces" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-spaces">
              Spaces
            </NavLink>
            <NavLink to="/notifications" className={({isActive}) => isActive ? "text-[#0A1628]" : "text-[#64748B] hover:text-[#0A1628]"} data-testid="nav-notifications">
              Notifications
            </NavLink>
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/community/new-post" className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium transition-colors" data-testid="new-post-btn">
                <PlusCircle className="w-4 h-4" />
                New Post
              </Link>
              <Link to="/notifications" className="p-2 hover:bg-[#F1F5F9] rounded-md text-[#64748B]" aria-label="Notifications" data-testid="bell-icon">
                <Bell className="w-5 h-5" />
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

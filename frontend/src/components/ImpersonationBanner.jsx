import React from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { toast } from "sonner";

/**
 * Persistent banner shown when an admin is impersonating another user.
 * The banner stays across all pages until the admin clicks "Stop impersonating".
 */
export default function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  if (!user?.impersonator_user_id) return null;

  const stop = async () => {
    const adminToken = localStorage.getItem("hcm_admin_token");
    if (!adminToken) {
      toast.error("Admin session not found — please sign in again.");
      localStorage.removeItem("hcm_token");
      await refresh();
      navigate("/login");
      return;
    }
    localStorage.setItem("hcm_token", adminToken);
    localStorage.removeItem("hcm_admin_token");
    try {
      await api.post("/auth/logout").catch(() => {}); // no-op for JWT, just clears any session
    } catch {}
    await refresh();
    toast.success("Stopped impersonating. You're back as admin.");
    navigate("/admin/members");
  };

  return (
    <div
      className="sticky top-0 z-50 bg-[#D97706] text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm shadow"
      data-testid="impersonation-banner"
    >
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>
        You are posting as <strong className="font-semibold">@{user.username}</strong>
        {user.impersonator_username && (
          <span className="opacity-80"> · admin: @{user.impersonator_username}</span>
        )}
      </span>
      <button
        onClick={stop}
        className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white/20 hover:bg-white/30 font-medium text-xs"
        data-testid="stop-impersonating-btn"
      >
        <LogOut className="w-3.5 h-3.5" /> Stop impersonating
      </button>
    </div>
  );
}

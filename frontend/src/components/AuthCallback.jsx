import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { popOAuthRedirect } from "../lib/redirect";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login");
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    api.post("/auth/emergent-session", { session_id: sessionId })
      .then(({ data }) => {
        login(data);
        // remove hash
        window.history.replaceState(null, "", window.location.pathname);
        const stashed = popOAuthRedirect();
        if (!data.user.onboarded) {
          navigate(stashed ? `/onboarding?redirect=${encodeURIComponent(stashed)}` : "/onboarding");
        } else {
          navigate(stashed || "/community");
        }
      })
      .catch(() => {
        navigate("/login");
      });
  }, [navigate, login]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center" data-testid="auth-callback">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#0D9373] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#64748B]">Signing you in...</p>
      </div>
    </div>
  );
}

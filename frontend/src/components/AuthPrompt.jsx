import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { loginHref } from "../lib/redirect";

/**
 * AuthPrompt — shared "sign in to continue" prompt for any gated action.
 *
 * Props:
 *   - message   string  Headline shown to the logged-out user.
 *                       Examples: "Sign in to rate this article",
 *                                 "Sign in to keep reading",
 *                                 "Sign in to join the discussion".
 *   - compact   boolean Inline single-row layout (default false).
 *                       When false, renders a full card matching other
 *                       on-page cards (white bg, border, rounded, padding).
 *
 * Both the "Sign In" and "Join Community" buttons preserve the current
 * URL via the shared redirect helper, so the user returns exactly where
 * they were after authenticating.
 */
export default function AuthPrompt({ message, compact = false }) {
  const location = useLocation();
  const signInTo = loginHref(location, "/login");
  const joinTo = loginHref(location, "/register");

  if (compact) {
    return (
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        data-testid="auth-prompt-compact"
      >
        <Lock className="w-4 h-4 text-[#94A3B8] shrink-0" />
        <span className="text-[#475569] flex-1 min-w-[180px]">{message}</span>
        <div className="flex gap-2 shrink-0">
          <Link
            to={signInTo}
            data-testid="auth-prompt-signin"
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-[#E2E8F0] hover:border-[#0D9373] text-xs font-medium text-[#0F172A] transition-colors"
          >
            Sign In
          </Link>
          <Link
            to={joinTo}
            data-testid="auth-prompt-join"
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-xs font-medium text-white transition-colors"
          >
            Join Community
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5"
      data-testid="auth-prompt"
    >
      <div className="w-12 h-12 rounded-md bg-[#F1F5F9] text-[#475569] flex items-center justify-center shrink-0">
        <Lock className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-[#0A1628]">{message}</div>
        <div className="text-sm text-[#64748B] mt-1 leading-relaxed">
          Free to join. No credit card required.
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link
          to={signInTo}
          data-testid="auth-prompt-signin"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[#E2E8F0] hover:border-[#0D9373] text-sm font-medium text-[#0F172A] transition-colors"
        >
          Sign In
        </Link>
        <Link
          to={joinTo}
          data-testid="auth-prompt-join"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-sm font-semibold text-white transition-colors"
        >
          Join Community
        </Link>
      </div>
    </div>
  );
}

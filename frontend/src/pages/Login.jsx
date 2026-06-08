import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data);
      toast.success(`Welcome back, ${data.user.full_name?.split(" ")[0]}`);
      navigate(data.user.onboarded ? "/community" : "/onboarding");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/community";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col" data-testid="login-page">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0A1628]" data-testid="back-link">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-md bg-[#0A1628] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#0D9373]" />
              </div>
              <span className="font-heading font-bold text-xl text-[#0A1628]">HCMOrbit</span>
            </Link>
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Welcome back</h1>
            <p className="text-sm text-[#64748B] mt-1">Sign in to continue the conversation.</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-7">
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full mb-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[#E2E8F0] hover:border-[#94A3B8] text-sm font-medium text-[#0F172A] transition-colors"
              data-testid="google-signin-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E2E8F0]"></div></div>
              <div className="relative flex justify-center text-xs text-[#94A3B8]"><span className="bg-white px-3 uppercase tracking-wider">Or with email</span></div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                  data-testid="login-email-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                  data-testid="login-password-input"
                />
              </div>
              {error && <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5" data-testid="login-error">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm transition-colors disabled:opacity-60"
                data-testid="login-submit-btn"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <div className="text-center text-sm text-[#64748B] mt-5">
              New here? <Link to="/register" className="text-[#0D9373] hover:underline font-medium" data-testid="register-link">Create an account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

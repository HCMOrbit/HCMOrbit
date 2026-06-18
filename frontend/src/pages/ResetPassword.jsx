import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const tokenMissing = !token.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      toast.success("Password updated. Redirecting to sign-in…");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col" data-testid="reset-password-page">
      <div className="p-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0A1628]" data-testid="back-to-login-link">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
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
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Choose a new password</h1>
            <p className="text-sm text-[#64748B] mt-1">At least 8 characters. Make it strong.</p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-7">
            {success ? (
              <div className="text-center" data-testid="reset-password-success">
                <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-[#0D9373]" />
                </div>
                <h2 className="font-heading text-lg font-semibold text-[#0A1628] mb-2">Password updated</h2>
                <p className="text-sm text-[#475569]">Redirecting you to sign in…</p>
              </div>
            ) : tokenMissing ? (
              <div className="text-center" data-testid="reset-password-missing-token">
                <p className="text-sm text-[#DC2626] mb-3">This reset link is missing its token.</p>
                <p className="text-sm text-[#64748B]">
                  <Link to="/forgot-password" className="text-[#0D9373] hover:underline font-medium">
                    Request a new reset link
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                    data-testid="reset-password-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">Confirm new password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                    data-testid="reset-password-confirm-input"
                  />
                </div>
                {error && (
                  <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5" data-testid="reset-password-error">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm transition-colors disabled:opacity-60"
                  data-testid="reset-password-submit-btn"
                >
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

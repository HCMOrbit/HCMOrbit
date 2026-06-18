import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api, formatApiError } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col" data-testid="forgot-password-page">
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
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Forgot your password?</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-7">
            {submitted ? (
              <div className="text-center" data-testid="forgot-password-success">
                <div className="w-12 h-12 rounded-full bg-[#E1F5EE] flex items-center justify-center mx-auto mb-4">
                  <MailCheck className="w-6 h-6 text-[#0D9373]" />
                </div>
                <h2 className="font-heading text-lg font-semibold text-[#0A1628] mb-2">Check your email</h2>
                <p className="text-sm text-[#475569] leading-relaxed">
                  If <strong className="text-[#0A1628]">{email}</strong> is associated with an HCMOrbit account,
                  you&apos;ll receive a reset link within the next minute. The link is valid for 1 hour.
                </p>
                <p className="text-xs text-[#94A3B8] mt-4">
                  Didn&apos;t get it? Check your spam folder, or{" "}
                  <button
                    onClick={() => { setSubmitted(false); setEmail(""); }}
                    className="text-[#0D9373] hover:underline font-medium"
                    data-testid="forgot-password-try-again"
                  >
                    try a different email
                  </button>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] focus:ring-2 focus:ring-[#0D9373]/20 outline-none text-sm bg-white"
                    data-testid="forgot-password-email-input"
                  />
                </div>
                {error && (
                  <div className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded p-2.5" data-testid="forgot-password-error">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 py-2.5 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white font-medium text-sm transition-colors disabled:opacity-60"
                  data-testid="forgot-password-submit-btn"
                >
                  {loading ? "Sending link..." : "Send reset link"}
                </button>
              </form>
            )}
            <div className="text-center text-sm text-[#64748B] mt-5">
              Remembered it? <Link to="/login" className="text-[#0D9373] hover:underline font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

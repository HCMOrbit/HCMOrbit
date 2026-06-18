import React, { useMemo, useState } from "react";
import { Mail, Send } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { toast } from "sonner";
import { WELCOME_EMAILS, buildWelcomeEmail } from "../../lib/welcomeEmailTemplates";

export default function AdminEmailPreviews() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("Workday Practitioner");
  const [sending, setSending] = useState(false);

  const { subject, html } = useMemo(
    () => buildWelcomeEmail(step, fullName || "Workday Practitioner"),
    [step, fullName]
  );

  const sendTest = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/admin/send-welcome-test", { step, full_name: fullName });
      if (data?.sent) toast.success(`Sent to ${data.to}`);
      else toast.error("Send failed — check Resend domain verification & backend logs.");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Email Previews</h1>
          <p className="text-sm text-[#64748B]">
            Render the welcome sequence in an isolated iframe — preview only, no scheduler or user records touched.
          </p>
        </div>
        <button
          onClick={sendTest}
          disabled={sending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-medium disabled:opacity-50"
          data-testid="email-previews-send-test-btn"
        >
          <Send className="w-4 h-4" />
          {sending ? "Sending..." : `Send test to ${user?.email || "my inbox"}`}
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4" role="tablist" data-testid="email-previews-tabs">
          {Object.entries(WELCOME_EMAILS).map(([k, v]) => {
            const n = Number(k);
            const active = step === n;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={active}
                onClick={() => setStep(n)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  active
                    ? "bg-[#0A1628] text-white border-[#0A1628]"
                    : "bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F1F5F9]"
                }`}
                data-testid={`email-previews-tab-${n}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end mb-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">
              Preview name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Workday Practitioner"
              className="w-full px-3 py-2 rounded border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9373]/30 focus:border-[#0D9373]"
              data-testid="email-previews-name-input"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#64748B] sm:pb-2">
            <Mail className="w-3.5 h-3.5 text-[#0D9373]" />
            <span className="font-medium truncate max-w-[300px]" data-testid="email-previews-subject">
              Subject: {subject}
            </span>
          </div>
        </div>

        {/* Iframe preview */}
        <iframe
          title={`Welcome Email ${step} preview`}
          srcDoc={html}
          sandbox=""
          className="w-full h-[720px] bg-white border border-[#E2E8F0] rounded"
          data-testid="email-previews-iframe"
        />
      </div>
    </AdminLayout>
  );
}

import React, { useState } from "react";
import { X, Flag } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const REASONS = ["Spam", "Misinformation", "Off-topic", "Inappropriate", "Other"];

export default function ReportModal({ open, targetId, targetType = "post", onClose }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!reason) { toast.error("Please choose a reason"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/reports", { target_id: targetId, target_type: targetType, reason });
      toast.success(data.duplicate ? "Already reported. Our team is on it." : "Report submitted. Thanks for helping keep HCMOrbit clean.");
      onClose();
      setReason("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't submit report");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="report-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-[#D97706]" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-lg text-[#0A1628]">Report this {targetType}</h3>
            <p className="text-sm text-[#64748B] mt-1.5">Help us keep HCMOrbit professional. What's wrong with this content?</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F5F9] rounded text-[#64748B]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-1.5">
          {REASONS.map((r) => (
            <label key={r} className={`flex items-center gap-2.5 px-3 py-2.5 rounded border cursor-pointer transition-colors ${reason === r ? "border-[#0D9373] bg-[#0D9373]/5" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}>
              <input
                type="radio" name="reason" value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-[#0D9373]"
                data-testid={`report-reason-${r.toLowerCase().replace(/[\s-]/g, "_")}`}
              />
              <span className="text-sm text-[#0F172A]">{r}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-[#475569] hover:bg-[#F1F5F9]">Cancel</button>
          <button
            onClick={submit} disabled={!reason || submitting}
            className="px-4 py-2 rounded text-sm font-medium text-white bg-[#0D9373] hover:bg-[#0b7c61] disabled:opacity-50"
            data-testid="report-submit"
          >
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

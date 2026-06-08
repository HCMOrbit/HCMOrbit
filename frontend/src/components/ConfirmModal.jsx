import React from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="confirm-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-lg text-[#0A1628]">{title}</h3>
            {message && <p className="text-sm text-[#64748B] mt-1.5 leading-relaxed">{message}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F5F9] rounded text-[#64748B]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-[#475569] hover:bg-[#F1F5F9]" data-testid="confirm-cancel">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-medium text-white ${danger ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#0D9373] hover:bg-[#0b7c61]"}`}
            data-testid="confirm-ok"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

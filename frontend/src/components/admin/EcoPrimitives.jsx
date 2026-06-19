/**
 * Shared UI primitives for the Ecosystem admin managers
 * (events + certifications). Extracted so both managers — and any future
 * ecosystem entity (sponsors, partners, …) — render with identical styling.
 */
import React from "react";
import { Pencil, Trash2, Save, X } from "lucide-react";

export const ecoInputCls =
  "w-full px-3 py-2 rounded-md border border-[#E2E8F0] text-sm focus:outline-none " +
  "focus:ring-2 focus:ring-[#0D9373]/30 focus:border-[#0D9373] bg-white";

export function EcoFormField({ label, wide = false, children }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-[#475569] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export function EcoStatusPill({ isPublished }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
        isPublished ? "bg-[#E1F5EE] text-[#0A7B59]" : "bg-[#F1F5F9] text-[#94A3B8]"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

export function EcoRowActions({ onEdit, onDelete, testIdPrefix, id }) {
  return (
    <div className="inline-flex gap-2">
      <button onClick={onEdit} className="p-1.5 rounded hover:bg-[#E2E8F0]" title="Edit"
              data-testid={`${testIdPrefix}-edit-${id}`}>
        <Pencil className="w-3.5 h-3.5 text-[#475569]" />
      </button>
      <button onClick={onDelete} className="p-1.5 rounded hover:bg-[#FEE2E2]" title="Delete"
              data-testid={`${testIdPrefix}-delete-${id}`}>
        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
      </button>
    </div>
  );
}

export function EcoFormShell({ title, onClose, onSubmit, saving, submitLabel, testIdPrefix, children }) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-[#0D9373]/30 rounded-lg p-5 mb-6 shadow-sm"
      data-testid={`${testIdPrefix}-form`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-base font-semibold text-[#0A1628]">{title}</h2>
        <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-[#0A1628]"
                data-testid={`${testIdPrefix}-form-close`}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-md border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9]">
          Cancel
        </button>
        <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0A1628] hover:bg-[#0F1F36] text-white text-sm font-medium disabled:opacity-60"
                data-testid={`${testIdPrefix}-form-submit`}>
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

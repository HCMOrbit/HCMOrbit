import React, { useEffect, useState, useCallback } from "react";
import { ExternalLink, Check, X } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { api, timeAgo, formatApiError } from "../../lib/api";
import { toast } from "sonner";

const TABS = ["pending", "reviewed", "dismissed"];

export default function AdminReported() {
  const [tab, setTab] = useState("pending");
  const [reports, setReports] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(() => {
    api.get(`/admin/reports?status=${tab}`).then((r) => setReports(r.data)).catch(() => {});
    api.get("/admin/reports/pending-count").then((r) => setPendingCount(r.data.count)).catch(() => {});
  }, [tab]);

  useEffect(load, [load]);

  const act = async (reportId, status, removeContent = false) => {
    try {
      const { data } = await api.patch(`/admin/reports/${reportId}`, { status, remove_content: removeContent });
      const msg = removeContent && data?.reporter_notified
        ? "Content removed. Reporter notified with a thank-you."
        : `Report ${status}${removeContent ? " and content removed" : ""}.`;
      toast.success(msg);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <AdminLayout pendingReports={pendingCount}>
      <h1 className="font-heading text-2xl font-semibold text-[#0A1628] mb-1">Reported Content</h1>
      <p className="text-sm text-[#64748B] mb-5">Community-submitted reports awaiting moderation.</p>

      <div className="flex gap-1 bg-white rounded-lg border border-[#E2E8F0] p-1 w-fit mb-5">
        {TABS.map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            data-testid={`reports-tab-${t}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? "bg-[#0A1628] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}
          >
            {t} {t === "pending" && pendingCount > 0 && <span className="ml-1 text-xs">({pendingCount})</span>}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-x-auto" data-testid="reports-table">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3 font-medium">Content</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Reporter</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]" data-testid={`report-row-${r.id}`}>
                <td className="px-4 py-3 max-w-[320px]">
                  <div className="text-sm text-[#0F172A] line-clamp-2">{r.target_preview?.title}</div>
                </td>
                <td className="px-4 py-3 text-xs text-[#64748B] capitalize">{r.target_type}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-medium">{r.reason}</span>
                </td>
                <td className="px-4 py-3 text-xs">{r.reporter?.full_name || r.reporter?.username}</td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{timeAgo(r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    <a href={r.target_preview?.link || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]" data-testid={`view-${r.id}`}>
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                    {tab === "pending" && (
                      <>
                        <button onClick={() => act(r.id, "dismissed")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-[#E2E8F0] hover:border-[#94A3B8] text-[#475569]" data-testid={`dismiss-${r.id}`}>
                          <X className="w-3 h-3" /> Dismiss
                        </button>
                        <button onClick={() => act(r.id, "reviewed", true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[#DC2626] hover:bg-[#B91C1C] text-white" data-testid={`remove-${r.id}`}>
                          Remove content
                        </button>
                      </>
                    )}
                    {tab === "reviewed" && <span className="text-xs text-[#16A34A] flex items-center gap-1"><Check className="w-3 h-3" /> Reviewed</span>}
                    {tab === "dismissed" && <span className="text-xs text-[#94A3B8]">Dismissed</span>}
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#94A3B8]">No {tab} reports.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

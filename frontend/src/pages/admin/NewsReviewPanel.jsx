import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ExternalLink, RefreshCw, Info,
} from "lucide-react";
import { api, formatApiError, timeAgo } from "../../lib/api";

const STATUS_TABS = [
  { key: "pending_review", label: "Needs Review" },
  { key: "published",      label: "Published" },
  { key: "rejected",       label: "Rejected" },
];

// Score → colored pill. Mirrors the scoring bands the backend enforces
// (>=80 publish / 60–79 review / <60 reject).
function ScorePill({ score }) {
  if (score === null || score === undefined) {
    return (
      <span
        className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#F1F5F9] text-[#94A3B8]"
        title="Legacy article — ingested before the relevance scorer"
        data-testid="news-score-pill"
      >
        Legacy
      </span>
    );
  }
  const band =
    score >= 80 ? { bg: "bg-[#D1FAE5]", fg: "text-[#065F46]", label: "Publish" } :
    score >= 60 ? { bg: "bg-[#FEF3C7]", fg: "text-[#92400E]", label: "Review" } :
                  { bg: "bg-[#FEE2E2]", fg: "text-[#991B1B]", label: "Reject" };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${band.bg} ${band.fg} whitespace-nowrap`}
      data-testid="news-score-pill"
    >
      {score} · {band.label}
    </span>
  );
}

// Compact "why" list — first 3 reasons, expandable. Kept tight because most
// admin decisions are made from the score+title alone; reasons are the audit.
function ReasonsList({ reasons }) {
  const [expanded, setExpanded] = useState(false);
  if (!reasons || reasons.length === 0) return null;
  const shown = expanded ? reasons : reasons.slice(0, 3);
  return (
    <ul className="mt-2 text-xs text-[#475569] space-y-0.5" data-testid="news-score-reasons">
      {shown.map((r, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <Info className="w-3 h-3 text-[#94A3B8] mt-0.5 shrink-0" />
          <span>{r}</span>
        </li>
      ))}
      {reasons.length > 3 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#0D9373] hover:underline mt-0.5"
            data-testid="news-score-reasons-toggle"
          >
            {expanded ? "Show less" : `+${reasons.length - 3} more`}
          </button>
        </li>
      )}
    </ul>
  );
}

function NewsCard({ item, onApprove, onReject, busy }) {
  const reasons = item?.score_breakdown?._reasons || [];
  const status = item.status;
  const canApprove = status !== "published";
  const canReject = status !== "rejected";
  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-col gap-2"
      data-testid={`news-review-card-${item.url}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[15px] font-semibold text-[#0A1628] hover:text-[#0D9373] inline-flex items-start gap-1.5"
            data-testid="news-review-title"
          >
            <span className="min-w-0">{item.title || "(untitled)"}</span>
            <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 text-[#94A3B8]" />
          </a>
          <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2">
            <span>{item.source || "unknown source"}</span>
            <span className="text-[#CBD5E1]">·</span>
            <span>{timeAgo(item.published_at)}</span>
          </div>
        </div>
        <ScorePill score={item.workday_score} />
      </div>

      {item.summary && (
        <p className="text-sm text-[#475569] line-clamp-2">{item.summary}</p>
      )}

      <ReasonsList reasons={reasons} />

      <div className="flex items-center justify-end gap-2 mt-2">
        {item.reviewed_by && (
          <span className="text-[11px] text-[#94A3B8] mr-auto">
            {item.review_action === "approve" ? "Approved" : "Rejected"} by @{item.reviewed_by} · {timeAgo(item.reviewed_at)}
          </span>
        )}
        {canReject && (
          <button
            type="button"
            onClick={() => onReject(item)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEE2E2] text-xs font-medium disabled:opacity-50 transition-colors"
            data-testid="news-review-reject-btn"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            onClick={() => onApprove(item)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0D9373] text-white hover:bg-[#0A7B59] text-xs font-medium disabled:opacity-50 transition-colors"
            data-testid="news-review-approve-btn"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </button>
        )}
      </div>
    </div>
  );
}

export default function NewsReviewPanel() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending_review: 0, published: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending_review");
  const [refreshing, setRefreshing] = useState(false);
  const [busyUrl, setBusyUrl] = useState(null);

  const load = async (statusFilter = tab) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/ecosystem/news?status=${statusFilter}&limit=100`);
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);  // load reads state via closure — safe

  const refreshFeed = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post("/admin/ecosystem/refresh-news");
      const parts = [];
      if (data?.new) parts.push(`${data.new} new`);
      if (data?.status_new) {
        const sn = data.status_new;
        parts.push(`${sn.published || 0} auto-published, ${sn.pending_review || 0} for review, ${sn.rejected || 0} rejected`);
      }
      toast.success(parts.length ? parts.join(" · ") : "Feed already up to date");
      await load(tab);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const handleAction = async (item, action) => {
    setBusyUrl(item.url);
    try {
      await api.post(`/admin/ecosystem/news/${action}`, { url: item.url });
      toast.success(action === "approve" ? "Approved — now live in Community News" : "Rejected");
      // Keep the tab experience snappy: drop the card from view immediately.
      setItems((prev) => prev.filter((i) => i.url !== item.url));
      setCounts((c) => ({
        ...c,
        [tab]: Math.max(0, (c[tab] || 0) - 1),
        [action === "approve" ? "published" : "rejected"]:
          (c[action === "approve" ? "published" : "rejected"] || 0) + 1,
      }));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyUrl(null);
    }
  };

  const tabButtons = useMemo(() => STATUS_TABS.map((t) => ({
    ...t,
    count: counts[t.key] || 0,
  })), [counts]);

  return (
    <div data-testid="admin-news-review-panel">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1" role="tablist" data-testid="news-review-status-tabs">
          {tabButtons.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#0A1628] text-white"
                    : "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]"
                }`}
                data-testid={`news-review-tab-${t.key}`}
              >
                {t.label} <span className={active ? "opacity-80" : "text-[#94A3B8]"}>({t.count})</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={refreshFeed}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-xs font-medium text-[#0A1628] hover:border-[#0D9373] hover:text-[#0D9373] disabled:opacity-50"
          data-testid="news-review-refresh-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Fetching…" : "Fetch new"}
        </button>
      </div>

      <div className="mb-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569] flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0D9373]" />
        <div>
          Articles are scored 0–100 for Workday relevance at ingestion time.{" "}
          <strong>≥ 80</strong> auto-publishes, <strong>60–79</strong> lands here for review,{" "}
          <strong>&lt; 60</strong> is rejected.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[#94A3B8] py-6 text-center" data-testid="news-review-loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-[#94A3B8] py-10 text-center" data-testid="news-review-empty">
          Nothing here — no items with status <em>{tab.replace("_", " ")}</em>.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => (
            <NewsCard
              key={it.url}
              item={it}
              busy={busyUrl === it.url}
              onApprove={(i) => handleAction(i, "approve")}
              onReject={(i) => handleAction(i, "reject")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

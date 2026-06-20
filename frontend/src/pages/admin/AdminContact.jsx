import React, { useEffect, useState } from "react";
import { Mail, Inbox, CheckCircle2, Circle, Reply, ChevronDown, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "../../components/AdminLayout";
import { api, timeAgo, formatApiError } from "../../lib/api";

const TOPIC_STYLES = {
  partnership:  "bg-[#0D9373]/10 text-[#0b7c61] border-[#0D9373]/20",
  press:        "bg-[#7C3AED]/10 text-[#6D28D9] border-[#7C3AED]/20",
  speaking:     "bg-[#2563EB]/10 text-[#1D4ED8] border-[#2563EB]/20",
  feedback:     "bg-[#F59E0B]/15 text-[#B45309] border-[#F59E0B]/30",
  support:      "bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/20",
  other:        "bg-[#E2E8F0] text-[#475569] border-[#CBD5E1]",
};

function TopicPill({ topic }) {
  const cls = TOPIC_STYLES[topic] || TOPIC_STYLES.other;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${cls}`}>
      {topic}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function MessageRow({ msg, expanded, onToggleExpand, onToggleResolved, busy }) {
  const subject = `Re: your message to HCMOrbit (${msg.topic})`;
  const body = `Hi ${msg.name.split(" ")[0]},\n\nThanks for reaching out — `;
  const mailto = `mailto:${msg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const preview = msg.message.length > 120 ? `${msg.message.slice(0, 120).trim()}…` : msg.message;

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden transition-shadow ${expanded ? "shadow-md border-[#CBD5E1]" : "border-[#E2E8F0]"} ${msg.resolved ? "opacity-75" : ""}`}
      data-testid={`contact-row-${msg.id}`}
    >
      {/* Row header (clickable) */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full text-left px-4 py-3 hover:bg-[#F8FAFC] flex items-start gap-4"
        data-testid={`contact-row-toggle-${msg.id}`}
      >
        <div className="shrink-0 mt-0.5">
          {msg.resolved
            ? <CheckCircle2 className="w-5 h-5 text-[#0D9373]" />
            : <Circle className="w-5 h-5 text-[#CBD5E1]" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-[#0A1628] ${msg.resolved ? "line-through decoration-[#94A3B8]/60" : ""}`}>
              {msg.name}
            </span>
            <span className="text-sm text-[#64748B] truncate">{msg.email}</span>
            <TopicPill topic={msg.topic} />
            {msg.company && (
              <span className="text-xs text-[#64748B]">· {msg.company}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#475569] truncate" data-testid={`contact-preview-${msg.id}`}>
            {preview}
          </p>
        </div>

        <div className="shrink-0 text-right flex flex-col items-end gap-1">
          <span className="text-xs text-[#94A3B8] whitespace-nowrap">{timeAgo(msg.submitted_at)}</span>
          <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4" data-testid={`contact-expanded-${msg.id}`}>
          <div className="grid sm:grid-cols-3 gap-3 mb-4 text-xs">
            <div>
              <div className="font-semibold uppercase tracking-wider text-[#94A3B8] mb-0.5">Received</div>
              <div className="text-[#0F172A]">{fmtDate(msg.submitted_at)}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wider text-[#94A3B8] mb-0.5">Company</div>
              <div className="text-[#0F172A]">{msg.company || "—"}</div>
            </div>
            <div>
              <div className="font-semibold uppercase tracking-wider text-[#94A3B8] mb-0.5 flex items-center gap-1">
                <Globe className="w-3 h-3" /> IP
              </div>
              <div className="text-[#0F172A] font-mono text-[11px]">{msg.ip || "—"}</div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-md p-4 mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">Message</div>
            <p className="whitespace-pre-wrap text-sm text-[#0F172A] leading-relaxed">{msg.message}</p>
          </div>

          {msg.resolved && msg.resolved_at && (
            <p className="text-xs text-[#0D9373] mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Resolved {fmtDate(msg.resolved_at)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={mailto}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold transition-colors"
              data-testid={`contact-reply-${msg.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Reply className="w-4 h-4" /> Reply via email
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleResolved(); }}
              disabled={busy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border transition-colors disabled:opacity-50 ${
                msg.resolved
                  ? "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#0A1628] hover:text-[#0A1628]"
                  : "bg-white border-[#0D9373] text-[#0D9373] hover:bg-[#0D9373] hover:text-white"
              }`}
              data-testid={`contact-toggle-resolved-${msg.id}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (msg.resolved ? <Circle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />)}
              {msg.resolved ? "Reopen" : "Mark resolved"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterTab({ value, label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-[#0A1628] text-white"
          : "text-[#475569] hover:text-[#0A1628] hover:bg-[#F1F5F9]"
      }`}
      data-testid={`contact-filter-${value}`}
    >
      {label} <span className="ml-1 counter opacity-75">{count}</span>
    </button>
  );
}

export default function AdminContact() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("open"); // open | resolved | all

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/contact");
      setItems(data.items || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleResolved = async (msg) => {
    setBusyId(msg.id);
    try {
      const { data } = await api.patch(`/admin/contact/${msg.id}`, { resolved: !msg.resolved });
      setItems((prev) => prev.map((m) => m.id === msg.id ? { ...m, resolved: data.resolved, resolved_at: data.resolved_at } : m));
      toast.success(data.resolved ? "Marked resolved" : "Reopened");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = items.filter((m) => {
    if (filter === "open")     return !m.resolved;
    if (filter === "resolved") return  m.resolved;
    return true;
  });

  const counts = {
    open:     items.filter((m) => !m.resolved).length,
    resolved: items.filter((m) =>  m.resolved).length,
    all:      items.length,
  };

  const FILTERS = [
    { value: "open",     label: "Open" },
    { value: "resolved", label: "Resolved" },
    { value: "all",      label: "All" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-contact-page">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#0A1628] tracking-tight flex items-center gap-2">
              <Inbox className="w-6 h-6 text-[#0D9373]" /> Contact inbox
            </h1>
            <p className="text-sm text-[#64748B] mt-1">
              Messages submitted via the public Connect page. Reply via email and mark resolved when handled.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-lg p-1" data-testid="contact-filters">
            {FILTERS.map((f) => (
              <FilterTab
                key={f.value}
                value={f.value}
                label={f.label}
                active={filter === f.value}
                count={counts[f.value]}
                onClick={() => setFilter(f.value)}
              />
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading messages…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E2E8F0] rounded-lg py-16 text-center" data-testid="contact-empty">
            <Mail className="w-10 h-10 mx-auto text-[#CBD5E1] mb-3" />
            <p className="text-[#475569] font-medium">
              {filter === "open" ? "No open messages — inbox zero." :
               filter === "resolved" ? "No resolved messages yet." :
               "No contact submissions yet."}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">New submissions land here in real time.</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="contact-list">
            {filtered.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                expanded={expandedId === msg.id}
                onToggleExpand={() => setExpandedId((cur) => cur === msg.id ? null : msg.id)}
                onToggleResolved={() => toggleResolved(msg)}
                busy={busyId === msg.id}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

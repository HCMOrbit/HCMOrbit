import React, { useEffect, useRef, useState } from "react";
import { X, Send, MessageCircle, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";

/**
 * Ask Orbit — floating global assistant widget.
 *
 * Mount once at the app root (outside the Router), so it renders on every
 * route and survives navigation. Collapsed → circular FAB bottom-right.
 * Expanded → 400px panel on desktop, full-screen sheet on mobile.
 *
 * State is React-only (no localStorage) — thread resets on reload, per spec.
 */
export default function AskOrbitWidget() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]); // [{ role, content } | { role: "answer", payload }]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Autoscroll on new turn.
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, sending]);

  const submit = async (e) => {
    e?.preventDefault?.();
    const q = input.trim();
    if (!q || sending) return;
    setInput("");
    setErrorMsg(null);
    // Append the user turn to the thread first (optimistic).
    const nextTurns = [...turns, { role: "user", content: q }];
    setTurns(nextTurns);
    setSending(true);
    try {
      // Only the raw {role, content} history is sent — no assistant "payload"
      // entries, since those are UI-shape not model-shape.
      const history = nextTurns
        .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(0, -1); // drop the just-appended user turn (backend takes it as `question`)
      const { data } = await api.post("/ask", { question: q, history });
      setTurns((cur) => [...cur, { role: "answer", payload: data }]);
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Collapsed floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Orbit"
          data-testid="ask-orbit-fab"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#1B3A6B",
            color: "#fff",
            border: "none",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.24)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 120ms ease, background 120ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Expanded panel — desktop 400px, mobile full-screen sheet */}
      {open && (
        <div
          data-testid="ask-orbit-panel"
          style={{
            position: "fixed",
            zIndex: 9999,
            bottom: 0,
            right: 0,
            background: "#fff",
            boxShadow: "0 16px 48px rgba(15, 23, 42, 0.22)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          className="w-full h-[100dvh] sm:w-[400px] sm:h-[70vh] sm:max-h-[720px] sm:min-h-[520px] sm:bottom-6 sm:right-6 sm:rounded-xl border border-[#E2E8F0]"
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0]"
            style={{ background: "linear-gradient(135deg, #0a1628 0%, #1B3A6B 100%)", color: "#fff" }}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-heading text-sm font-semibold" data-testid="ask-orbit-title">
              Ask Orbit
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: "#F5B731", color: "#0a1628" }}
              data-testid="ask-orbit-beta"
            >
              Beta
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Ask Orbit"
              data-testid="ask-orbit-close"
              className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="ask-orbit-thread">
            {turns.length === 0 && <EmptyState />}
            {turns.map((t, i) => (
              t.role === "user" ? (
                <UserBubble key={i} text={t.content} />
              ) : t.role === "assistant" ? (
                <AssistantBubble key={i} text={t.content} />
              ) : (
                <AnswerCard key={i} payload={t.payload} />
              )
            ))}
            {sending && <ThinkingBubble />}
            {errorMsg && (
              <div className="text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded px-3 py-2" data-testid="ask-orbit-error">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Persistent community footer */}
          <a
            href="/community"
            className="border-t border-[#E2E8F0] px-4 py-2.5 text-xs text-[#475569] bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center gap-1.5"
            data-testid="ask-orbit-community-cta"
          >
            <span>Still stuck, or think the KB is missing this?</span>
            <span className="text-[#0D9373] font-semibold inline-flex items-center gap-0.5">
              Ask the community <ArrowRight className="w-3 h-3" />
            </span>
          </a>

          {/* Input pinned bottom */}
          <form onSubmit={submit} className="border-t border-[#E2E8F0] px-3 py-3 flex items-end gap-2 bg-white">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
              placeholder="Describe what's happening in your tenant…"
              disabled={sending}
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-sm border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1B3A6B] disabled:opacity-60 max-h-28"
              style={{ minHeight: 38 }}
              data-testid="ask-orbit-input"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send question"
              data-testid="ask-orbit-send"
              className="px-3 py-2 rounded text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: "#1B3A6B" }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-[#64748B] leading-relaxed py-4" data-testid="ask-orbit-empty">
      <div className="font-heading text-[15px] font-semibold text-[#0A1628] mb-2">
        Ask Orbit knows your KB.
      </div>
      <p className="mb-2">
        Ask about Workday HCM, Payroll, Integrations, Security — grounded in HCMOrbit
        articles, never made up.
      </p>
      <p className="text-xs text-[#94A3B8]">
        Try: <em>"How do I check which security groups a user has after a role change?"</em>
      </p>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end" data-testid="ask-orbit-user-turn">
      <div className="max-w-[85%] px-3 py-2 rounded-lg bg-[#1B3A6B] text-white text-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text }) {
  return (
    <div className="flex" data-testid="ask-orbit-assistant-turn">
      <div className="max-w-[85%] px-3 py-2 rounded-lg bg-[#F1F5F9] text-[#0A1628] text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex" data-testid="ask-orbit-thinking">
      <div className="px-3 py-2 rounded-lg bg-[#F1F5F9] text-[#64748B] text-xs inline-flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Searching the KB…
      </div>
    </div>
  );
}

function AnswerCard({ payload }) {
  const { answer, tenant_check: tc, sources = [], in_scope: inScope } = payload || {};
  const outOfScope = inScope === false;
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 space-y-3" data-testid="ask-orbit-answer">
      <p className="text-sm text-[#0A1628] leading-relaxed whitespace-pre-wrap" data-testid="ask-orbit-answer-text">
        {answer}
      </p>
      {tc && (
        <div
          className="rounded-md border border-[#F5B731]/40 bg-[#FFFBEB] px-3 py-2 space-y-1 text-xs"
          data-testid="ask-orbit-tenant-check"
        >
          <div className="font-semibold text-[#92400E] uppercase tracking-wider text-[10px]">
            Check your tenant
          </div>
          <div><span className="font-semibold text-[#0A1628]">Report:</span> {tc.report}</div>
          <div><span className="font-semibold text-[#0A1628]">Filter:</span> {tc.filter}</div>
          <div><span className="font-semibold text-[#0A1628]">Healthy:</span> {tc.healthy}</div>
        </div>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="ask-orbit-sources">
          {sources.map((s) => (
            <a
              key={s.reference_id}
              href={`/knowledge-base/by-ref/${encodeURIComponent(s.reference_id)}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-[#F1F5F9] text-[#0A1628] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]"
              data-testid={`ask-orbit-source-${s.reference_id}`}
            >
              <span className="font-mono font-semibold">{s.reference_id}</span>
              <span className="text-[#64748B]">· {s.section_title}</span>
              <ExternalLink className="w-2.5 h-2.5 text-[#94A3B8]" />
            </a>
          ))}
        </div>
      )}
      {outOfScope && (
        <div className="text-[11px] text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded px-2 py-1">
          The KB doesn't cover this yet — ask the community below.
        </div>
      )}
    </div>
  );
}

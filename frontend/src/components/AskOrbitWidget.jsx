import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { X, Send, MessageCircle, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";

// Proactive cue timings.
const WELCOME_DELAY_MS = 10000; // 10s after mount
const IDLE_DELAY_MS = 50000;    // 45–60s window; use 50s

/**
 * Ask Orbit — floating global assistant widget.
 *
 * Mount once at the app root, inside BrowserRouter, so it renders on every
 * route and survives navigation. Collapsed → circular FAB bottom-right.
 * Expanded → 400px panel on desktop, full-screen sheet on mobile.
 *
 * State is React-only (no localStorage) — thread resets on reload, per spec.
 *
 * Proactive surfacing:
 *  - Welcome cue: 10s after first mount, small tooltip near FAB (once per session).
 *  - Idle cue: 50s of no click/scroll/keydown on the same route, dismissible per route.
 *  - Both suppressed once the user opens the panel at least once.
 *  - At most ONE cue per page view.
 */
export default function AskOrbitWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState([]); // [{ role, content } | { role: "answer", payload }]
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const scrollRef = useRef(null);

  // Proactive-cue state.
  const [cueType, setCueType] = useState(null); // null | "welcome" | "idle"
  const [pulse, setPulse] = useState(false);
  const openedOnceRef = useRef(false);
  const welcomeShownRef = useRef(false);
  const idleDismissedRoutesRef = useRef(new Set());
  const cuedThisRouteRef = useRef(false);
  const cueTypeRef = useRef(null); // mirrors cueType for use inside timer callbacks
  const tooltipRef = useRef(null);
  const fabRef = useRef(null);

  useEffect(() => { cueTypeRef.current = cueType; }, [cueType]);

  useEffect(() => {
    // Autoscroll on new turn.
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, sending]);

  const openWidget = useCallback(() => {
    openedOnceRef.current = true;
    setCueType(null);
    setPulse(false);
    setOpen(true);
  }, []);

  const dismissCue = useCallback(() => {
    setCueType((cur) => {
      if (cur === "idle") idleDismissedRoutesRef.current.add(location.pathname);
      return null;
    });
    setPulse(false);
  }, [location.pathname]);

  const openFromCue = useCallback(() => {
    idleDismissedRoutesRef.current.add(location.pathname);
    openWidget();
  }, [location.pathname, openWidget]);

  // Welcome cue — 10s after first mount, once per session, only if user hasn't opened widget.
  useEffect(() => {
    if (welcomeShownRef.current || openedOnceRef.current) return;
    const t = setTimeout(() => {
      if (openedOnceRef.current || welcomeShownRef.current) return;
      if (cueTypeRef.current) return; // another cue already showing
      welcomeShownRef.current = true;
      cuedThisRouteRef.current = true;
      setCueType("welcome");
      setPulse(true);
    }, WELCOME_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Idle cue — re-arms on every route entry, resets on click/scroll/keydown.
  useEffect(() => {
    // Reset per-route cap on route change. Preserve it if welcome is still on screen
    // (welcome counts as this route's one allowed cue).
    cuedThisRouteRef.current = cueTypeRef.current === "welcome";
    // Dismiss any lingering idle tooltip on nav.
    setCueType((cur) => (cur === "idle" ? null : cur));

    if (openedOnceRef.current) return undefined;

    let idleTimer;
    const armTimer = () => {
      clearTimeout(idleTimer);
      if (openedOnceRef.current) return;
      if (idleDismissedRoutesRef.current.has(location.pathname)) return;
      idleTimer = setTimeout(() => {
        if (openedOnceRef.current) return;
        if (cueTypeRef.current) return; // welcome (or anything else) is on screen — suppress idle
        if (cuedThisRouteRef.current) return; // already used this route's cue slot
        if (idleDismissedRoutesRef.current.has(location.pathname)) return;
        cuedThisRouteRef.current = true;
        setCueType("idle");
      }, IDLE_DELAY_MS);
    };

    const onInteract = () => armTimer();
    armTimer();
    window.addEventListener("click", onInteract, { passive: true });
    window.addEventListener("scroll", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract, { passive: true });
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("click", onInteract);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, [location.pathname]);

  // Click-outside → dismiss tooltip. Do not dismiss when clicking FAB or tooltip itself.
  useEffect(() => {
    if (!cueType) return undefined;
    const onDocClick = (e) => {
      if (tooltipRef.current?.contains(e.target)) return;
      if (fabRef.current?.contains(e.target)) return;
      dismissCue();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [cueType, dismissCue]);

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
        <>
          <button
            ref={fabRef}
            type="button"
            onClick={openWidget}
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
            {pulse && (
              <span
                aria-hidden="true"
                data-testid="ask-orbit-fab-pulse"
                style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: "50%",
                  border: "2px solid rgba(245, 183, 49, 0.7)",
                  animation: "askorbit-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
                  pointerEvents: "none",
                }}
              />
            )}
            <MessageCircle className="w-6 h-6" />
          </button>
          {cueType && (
            <ProactiveCue
              ref={tooltipRef}
              type={cueType}
              onOpen={openFromCue}
              onDismiss={dismissCue}
            />
          )}
          <style>{`
            @keyframes askorbit-ping {
              0%   { transform: scale(1);    opacity: 0.85; }
              80%, 100% { transform: scale(1.35); opacity: 0; }
            }
          `}</style>
        </>
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

const ProactiveCue = React.forwardRef(function ProactiveCue({ type, onOpen, onDismiss }, ref) {
  const isWelcome = type === "welcome";
  const label = isWelcome
    ? "New here? Ask me anything about Workday."
    : "Stuck? Ask Orbit anything about this page.";
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-testid={isWelcome ? "ask-orbit-cue-welcome" : "ask-orbit-cue-idle"}
      style={{
        position: "fixed",
        bottom: 90, // 24 (FAB bottom) + 56 (FAB) + 10 gap
        right: 24,
        zIndex: 9998,
        maxWidth: 260,
        background: "#0A1628",
        color: "#fff",
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.28)",
        border: "1px solid rgba(245, 183, 49, 0.35)",
        padding: "10px 12px",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        animation: "askorbit-cue-in 220ms ease-out",
      }}
    >
      <style>{`
        @keyframes askorbit-cue-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <button
        type="button"
        onClick={onOpen}
        data-testid="ask-orbit-cue-open"
        className="text-left flex-1 text-[13px] leading-snug font-medium hover:underline"
        style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 0 }}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        data-testid="ask-orbit-cue-dismiss"
        className="flex-shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
        style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Down-pointing arrow toward FAB */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -6,
          right: 22,
          width: 12,
          height: 12,
          background: "#0A1628",
          borderRight: "1px solid rgba(245, 183, 49, 0.35)",
          borderBottom: "1px solid rgba(245, 183, 49, 0.35)",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
});

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

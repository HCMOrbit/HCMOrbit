import React, { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import AuthPrompt from "./AuthPrompt";
import { toast } from "sonner";

export default function VoteComponent({ targetId, targetType, initialCount = 0, initialVote = 0, orientation = "vertical" }) {
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [vote, setVote] = useState(initialVote);
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!showPrompt) return;
    const onClick = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowPrompt(false); };
    document.addEventListener("mousedown", onClick);
    const t = setTimeout(() => setShowPrompt(false), 6000);
    return () => { document.removeEventListener("mousedown", onClick); clearTimeout(t); };
  }, [showPrompt]);

  const cast = async (value) => {
    if (!user) {
      setShowPrompt(true);
      return;
    }
    if (loading) return;
    setLoading(true);
    // optimistic
    const prev = { count, vote };
    let optimisticDelta = 0;
    let newVote = value;
    if (vote === value) { optimisticDelta = -value; newVote = 0; }
    else if (vote === 0) { optimisticDelta = value; }
    else { optimisticDelta = value * 2; }
    setCount(count + optimisticDelta);
    setVote(newVote);
    try {
      const { data } = await api.post("/votes", { target_id: targetId, target_type: targetType, value });
      setCount(data.new_count);
      setVote(data.user_vote);
    } catch (e) {
      setCount(prev.count);
      setVote(prev.vote);
      toast.error(e?.response?.data?.detail || "Vote failed");
    } finally {
      setLoading(false);
    }
  };

  const containerClass = orientation === "vertical"
    ? "flex flex-col items-center gap-1"
    : "inline-flex items-center gap-2";

  return (
    <div ref={wrapperRef} className={`relative ${containerClass}`} data-testid={`vote-${targetType}-${targetId}`}>
      <button
        type="button"
        aria-label="Upvote"
        onClick={() => cast(1)}
        data-testid={`upvote-${targetId}`}
        className={`p-1 rounded transition-colors ${vote === 1 ? "text-[#0D9373]" : "text-[#94A3B8] hover:text-[#0D9373] hover:bg-[#0D9373]/5"}`}
      >
        <ChevronUp className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <span className="text-base font-semibold text-[#0F172A] counter min-w-[1.5rem] text-center" data-testid={`vote-count-${targetId}`}>
        {count}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        onClick={() => cast(-1)}
        data-testid={`downvote-${targetId}`}
        className={`p-1 rounded transition-colors ${vote === -1 ? "text-[#DC2626]" : "text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#DC2626]/5"}`}
      >
        <ChevronDown className="w-5 h-5" strokeWidth={2.5} />
      </button>
      {showPrompt && (
        <div
          className={`absolute z-30 w-[320px] p-3 bg-white border border-[#E2E8F0] rounded-lg shadow-lg ${
            orientation === "vertical" ? "left-full ml-2 top-0" : "top-full mt-2 left-1/2 -translate-x-1/2"
          }`}
          data-testid="vote-auth-prompt"
        >
          <AuthPrompt compact message="Sign in to react to this post" />
        </div>
      )}
    </div>
  );
}

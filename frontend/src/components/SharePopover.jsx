import React, { useState, useRef, useEffect } from "react";
import { Share2, Link2, Linkedin, Twitter, Check } from "lucide-react";
import { toast } from "sonner";

export default function SharePopover({ url, title, type = "post" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const shareText = `From HCMOrbit: "${title}"`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Long-press the link instead.");
    }
  };

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;
  // LinkedIn deprecated text param but we still pass it for newer clients
  const linkedinText = type === "success_story"
    ? `I just shared how I solved this on HCMOrbit — ${title}`
    : `Worth a read on HCMOrbit — ${title}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 hover:text-[#0A1628] text-[#94A3B8]"
        aria-label="Share"
        data-testid="share-btn"
      >
        <Share2 className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute left-full ml-2 top-0 z-30 w-64 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-2"
          data-testid="share-popover"
        >
          <button onClick={copy} className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-[#0F172A] hover:bg-[#F8FAFC]" data-testid="share-copy">
            {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Link2 className="w-4 h-4 text-[#64748B]" />}
            <span>{copied ? "Copied!" : "Copy link"}</span>
          </button>
          <a
            href={linkedinUrl}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
            data-testid="share-linkedin"
            onClick={() => {
              // Also copy the pre-fill text for the user since LinkedIn no longer honors share text
              try { navigator.clipboard.writeText(linkedinText); toast.message("Caption copied — paste it into LinkedIn."); } catch (_e) { /* ignore */ }
            }}
          >
            <Linkedin className="w-4 h-4 text-[#1D6FE8]" />
            <span>Share to LinkedIn</span>
          </a>
          <a
            href={twitterUrl}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
            data-testid="share-twitter"
          >
            <Twitter className="w-4 h-4 text-[#1DA1F2]" />
            <span>Share to X</span>
          </a>
        </div>
      )}
    </div>
  );
}

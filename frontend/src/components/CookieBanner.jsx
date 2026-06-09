import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const COOKIE_NAME = "hcmorbit_cookie_consent";
const LS_KEY = "cookie_consent";

function getCookie(name) {
  return document.cookie.split("; ").find((r) => r.startsWith(name + "="))?.split("=")[1];
}
function setCookie(name, value, days) {
  const exp = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${exp}; path=/; SameSite=Lax`;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const consent = getCookie(COOKIE_NAME) || localStorage.getItem(LS_KEY);
    if (!consent) setVisible(true);
  }, []);

  const decide = (value) => {
    setCookie(COOKIE_NAME, value, 365);
    try { localStorage.setItem(LS_KEY, value); } catch {}
    setClosing(true);
    setTimeout(() => setVisible(false), 250);
  };

  if (!visible) return null;
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] bg-[#0A1628] border-t border-[#0D9373]/40 transition-transform duration-200 ${closing ? "translate-y-full" : "translate-y-0"}`}
      data-testid="cookie-banner"
      role="region" aria-label="Cookie consent"
    >
      <div className="max-w-[1200px] mx-auto px-5 py-3.5 flex flex-col md:flex-row items-center gap-3 md:gap-5">
        <p className="text-xs md:text-sm text-white/80 leading-relaxed flex-1">
          We use essential cookies to keep you logged in and remember your preferences. We do not use advertising or tracking cookies. Read our <Link to="/cookies" className="text-[#0D9373] hover:underline">Cookie Policy</Link> for details.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => decide("declined")} className="px-4 py-1.5 rounded text-sm font-medium border border-white/30 text-white hover:bg-white/10" data-testid="cookie-decline">Decline</button>
          <button onClick={() => decide("accepted")} className="px-4 py-1.5 rounded text-sm font-medium bg-[#0D9373] hover:bg-[#0b7c61] text-white" data-testid="cookie-accept">Accept</button>
        </div>
      </div>
    </div>
  );
}

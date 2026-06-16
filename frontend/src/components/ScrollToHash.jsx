import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Mounted once in App.js — handles `#anchor` navigation site-wide.
 *
 * Browsers natively scroll to fragment IDs on full page loads, but React
 * Router intercepts client-side link clicks and the browser never gets the
 * signal. This component watches `location.hash` and explicitly scrolls.
 *
 * Pages with async-loaded content (e.g. KB doc markdown rendered after an
 * API fetch) won't have the target element in the DOM yet on the first
 * tick. We retry at increasing delays so the scroll succeeds once the
 * heading appears, without polling forever.
 */
export default function ScrollToHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    const delays = [0, 100, 300, 700, 1500];
    const timers = [];
    let landed = false;

    const tryScroll = () => {
      if (landed) return;
      const el = document.getElementById(id);
      if (el) {
        landed = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    for (const ms of delays) {
      timers.push(setTimeout(tryScroll, ms));
    }
    return () => timers.forEach(clearTimeout);
  }, [hash]);

  return null;
}

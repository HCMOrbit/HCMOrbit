import { useEffect, useRef, useState } from "react";

/**
 * useResizable — minimal pointer-based horizontal resize hook.
 *
 * Returns `{ width, startDrag, isDragging }`:
 *   - `width`        the current width in px, clamped to [min, max]
 *   - `startDrag`    onMouseDown handler for the drag handle
 *   - `isDragging`   true while a drag is in progress
 *
 * The chosen width is persisted to localStorage under `storageKey` so it
 * survives page navigation and reloads. Default lives in code (not storage)
 * so a tampered/empty entry never breaks the layout.
 *
 * No external libraries — uses window mousemove/mouseup listeners with a
 * shared cursor lock on document.body during drag.
 */
export default function useResizable({
  storageKey,
  defaultWidth,
  min,
  max,
}) {
  const clamp = (n) => Math.min(max, Math.max(min, n));

  const [width, setWidth] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const stored = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(stored)) return clamp(stored);
    } catch {
      /* ignore */
    }
    return defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Persist on every committed width change.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch {
      /* ignore quota errors */
    }
  }, [storageKey, width]);

  const startRef = useRef(null);
  const startDrag = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, w: width };
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      const s = startRef.current;
      if (!s) return;
      setWidth(clamp(s.w + (ev.clientX - s.x)));
    };
    const onUp = () => {
      setIsDragging(false);
      startRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { width, startDrag, isDragging };
}

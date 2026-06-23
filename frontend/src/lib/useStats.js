import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Single source of truth for site-wide counts (KB articles, members,
 * events, etc.). All numbers come from GET /api/stats, which mirrors the
 * exact Mongo filters used by the corresponding listing endpoints.
 *
 * Behavior — no silent fallbacks by design:
 *   - `loading=true` while the first fetch is in flight; UI shows a dash.
 *   - On fetch failure, `loading=false`, `error` is set, and `stats={}` so
 *     individual tiles render `—` rather than a fake number.
 *   - First successful fetch is cached for the session; subsequent renders
 *     are instant.
 */
const _cache = { data: null, promise: null };

export function useStats() {
  const [stats, setStats]     = useState(_cache.data || {});
  const [loading, setLoading] = useState(!_cache.data);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (_cache.data) {
      setStats(_cache.data);
      setLoading(false);
      return;
    }
    if (!_cache.promise) {
      _cache.promise = api.get("/stats").then(
        (r) => {
          _cache.data = r.data || {};
          return { data: _cache.data };
        },
        (err) => {
          _cache.promise = null;            // allow next mount to retry
          console.error("[useStats] /api/stats failed", err);
          return { error: err };
        }
      );
    }
    let cancelled = false;
    _cache.promise.then(({ data, error: err }) => {
      if (cancelled) return;
      if (data) setStats(data);
      if (err)  setError(err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}

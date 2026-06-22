import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Single source of truth for site-wide counts (KB articles, members,
 * events, etc.). All numbers come from GET /api/stats, which mirrors the
 * exact Mongo filters used by the corresponding listing endpoints.
 *
 * Usage:
 *   const { stats, loading } = useStats();
 *   loading ? "—" : stats.kb_articles
 *
 * Returns `loading=true` until the first fetch resolves, with `stats={}`
 * so callers can safely destructure / render a skeleton (no hardcoded
 * fallback numbers, by design).
 */
const _cache = { data: null, promise: null };

export function useStats() {
  const [stats, setStats]   = useState(_cache.data || {});
  const [loading, setLoading] = useState(!_cache.data);

  useEffect(() => {
    if (_cache.data) {
      setStats(_cache.data);
      setLoading(false);
      return;
    }
    if (!_cache.promise) {
      _cache.promise = api.get("/stats").then((r) => {
        _cache.data = r.data || {};
        return _cache.data;
      }).catch(() => {
        _cache.promise = null;
        return null;
      });
    }
    let cancelled = false;
    _cache.promise.then((data) => {
      if (cancelled) return;
      if (data) setStats(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}

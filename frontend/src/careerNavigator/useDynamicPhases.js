/**
 * useDynamicPhases — fetches KB docs for a category, groups by sub_module,
 * and returns a phases array in the exact shape PhaseSpine already renders
 * for Payroll. No new layout, no new component — same data contract.
 *
 * Contract of the returned phases array (unchanged from Payroll):
 *   [{ n, title, timeframe?, summary, guides: [{docId, title}], checkpoint? }]
 *
 * Sub-module ordering:   alphabetical (case-insensitive).
 * Within-group ordering: difficulty ASC (beginner<intermediate<advanced,
 *                        null last) → reference_id → title.
 *
 * Excluded intentionally: `timeframe` (a sub_module isn't a duration),
 * `checkpoint` (nothing to auto-derive). Both are optional in PhaseSpine.
 */
import { useEffect, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

function sortDocs(a, b) {
  const da = DIFFICULTY_ORDER[a.difficulty];
  const db = DIFFICULTY_ORDER[b.difficulty];
  const av = da === undefined ? 99 : da;
  const bv = db === undefined ? 99 : db;
  if (av !== bv) return av - bv;
  const ra = a.reference_id || "";
  const rb = b.reference_id || "";
  if (ra !== rb) return ra < rb ? -1 : 1;
  return (a.title || "").localeCompare(b.title || "");
}

export default function useDynamicPhases(categorySlug) {
  const [state, setState] = useState({ phases: [], total: 0, loading: false, error: null });

  useEffect(() => {
    if (!categorySlug) {
      setState({ phases: [], total: 0, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/kb/docs`, {
          params: { category: categorySlug, lite: true, limit: 500 },
        });
        if (cancelled) return;
        const docs = Array.isArray(data?.docs) ? data.docs : [];
        const groups = new Map();
        for (const d of docs) {
          const sub = (d.sub_module || "").trim() || "Uncategorized";
          if (!groups.has(sub)) groups.set(sub, []);
          groups.get(sub).push(d);
        }
        const subNames = Array.from(groups.keys()).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
        const phases = subNames.map((sub, i) => {
          const items = groups.get(sub).slice().sort(sortDocs);
          return {
            n: i + 1,
            title: sub,
            summary: `${items.length} ${items.length === 1 ? "guide" : "guides"}`,
            guides: items.map((d) => ({
              docId: d.reference_id || d.id,
              title: d.title,
            })),
          };
        });
        setState({ phases, total: docs.length, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          phases: [], total: 0, loading: false,
          error: e?.response?.data?.detail || e?.message || "Failed to load track",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [categorySlug]);

  return state;
}

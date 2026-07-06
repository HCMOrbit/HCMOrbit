import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";

/**
 * Resolves an Ask Orbit source chip like `/knowledge-base/by-ref/HCM-CORE-KB-001`
 * → hits GET /api/kb/by-ref/{reference_id} → redirects to
 * `/knowledge-base/{category_slug}/{id}`. Purely a redirect page — never
 * user-visible for long.
 */
export default function KBRefResolver() {
  const { referenceId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = React.useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/kb/by-ref/${encodeURIComponent(referenceId)}`);
        if (cancelled) return;
        navigate(`/knowledge-base/${data.category_slug}/${data.id}`, { replace: true });
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [referenceId, navigate]);

  return (
    <div className="max-w-[720px] mx-auto px-6 py-16 text-center" data-testid="kb-ref-resolver">
      {error ? (
        <>
          <div className="text-sm text-[#B91C1C] mb-4">{error}</div>
          <a href="/knowledge-base" className="text-sm text-[#0D9373] hover:underline">
            Back to Knowledge Base
          </a>
        </>
      ) : (
        <div className="text-sm text-[#64748B]">Loading {referenceId}…</div>
      )}
    </div>
  );
}

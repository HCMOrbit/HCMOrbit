import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Loader2, Trash2, PlusCircle, ArrowRight } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import PageHero from "../../components/PageHero";
import { api, formatApiError } from "../../lib/api";

export default function DocwrightHistory() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/docwright/documents");
      setDocs(data.documents || []);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/docwright/documents/${id}`);
      setDocs((prev) => (prev || []).filter((d) => d.id !== id));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="docwright-history">
      <NavHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <PageHero
          eyebrow="Docwright · History"
          title="Your past documents"
          subtitle="Re-open, edit, or download any document you've generated."
        />

        <div className="mt-6 flex justify-end">
          <Link
            to="/docwright"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold"
            data-testid="docwright-new-doc-button"
          >
            <PlusCircle className="w-4 h-4" /> New document
          </Link>
        </div>

        {error && (
          <div className="mt-4 text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded px-3 py-2" data-testid="docwright-history-error">
            {error}
          </div>
        )}

        <div className="mt-4 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
          {docs === null ? (
            <div className="p-10 text-center text-[#64748B]" data-testid="docwright-history-loading">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="p-12 text-center" data-testid="docwright-history-empty">
              <FileText className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <div className="font-heading font-semibold text-[#0A1628] mb-1">No documents yet</div>
              <p className="text-sm text-[#64748B] mb-4">Generate your first design document to see it here.</p>
              <Link
                to="/docwright"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white text-sm font-semibold"
              >
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="docwright-history-table">
              <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Module</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Phase</th>
                  <th className="text-left px-4 py-3">Updated</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]" data-testid={`docwright-history-row-${d.id}`}>
                    <td className="px-4 py-3 font-medium text-[#0A1628]">{d.client_name}</td>
                    <td className="px-4 py-3 text-[#475569]">{d.module}</td>
                    <td className="px-4 py-3 text-[#475569]">{d.doc_type}</td>
                    <td className="px-4 py-3 text-[#475569]">{d.phase}</td>
                    <td className="px-4 py-3 text-[#64748B] text-xs">
                      {new Date(d.updated_at || d.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/docwright/result/${d.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E2E8F0] hover:border-[#0D9373] text-xs font-semibold text-[#0A1628]"
                          data-testid={`docwright-history-open-${d.id}`}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(d.id)}
                          disabled={deletingId === d.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-transparent hover:bg-[#FEE2E2] text-xs font-semibold text-[#B91C1C] disabled:opacity-50"
                          data-testid={`docwright-history-delete-${d.id}`}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

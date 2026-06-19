import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import { CertRow } from "../Ecosystem";
import { api } from "../../lib/api";

export default function EcosystemCertifications() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/certifications")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled) setCerts(Array.isArray(items) ? items : []);
      })
      .catch(() => { if (!cancelled) setCerts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-certifications-page">
      <NavHeader />
      <EcosystemSubpageHero
        eyebrow="CERTIFICATION WATCH"
        title="Workday certifications & learning paths"
        description="New releases, upcoming exams, and recertification updates — track what's changing across Workday Learning."
        current="Certifications"
      />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">
              All certifications
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-[#64748B]" data-testid="certs-count">
              {certs.length} {certs.length === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-[#64748B] py-12 text-center" data-testid="certs-loading">
            Loading certifications…
          </div>
        ) : certs.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="certs-empty"
          >
            <ClipboardList className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B]">No certification updates yet. Check back soon.</p>
          </div>
        ) : (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
            data-testid="certs-list"
          >
            {certs.map((c, i) => (
              <CertRow key={c.id} c={c} isLast={i === certs.length - 1} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

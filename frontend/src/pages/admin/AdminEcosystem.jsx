import React from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { Calendar, Award, Newspaper } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import EventsPanel from "./EventsPanel";
import CertificationsPanel from "./CertificationsPanel";
import NewsReviewPanel from "./NewsReviewPanel";

const TABS = [
  { key: "events",         label: "Events",              icon: Calendar,   panel: <EventsPanel /> },
  { key: "news-review",    label: "News Review",         icon: Newspaper,  panel: <NewsReviewPanel /> },
  { key: "certifications", label: "Certification Watch", icon: Award,      panel: <CertificationsPanel /> },
];

export default function AdminEcosystem() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const active = TABS.find((t) => t.key === requested) ? requested : "events";

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Ecosystem manager</h1>
        <p className="text-sm text-[#64748B] mt-1">Manage events and certifications surfaced on the public /ecosystem page.</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-[#E2E8F0]" role="tablist" data-testid="admin-ecosystem-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSearchParams({ tab: t.key })}
              className={`inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#0D9373] text-[#0A1628]"
                  : "border-transparent text-[#64748B] hover:text-[#0A1628] hover:border-[#CBD5E1]"
              }`}
              data-testid={`admin-ecosystem-tab-${t.key}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.find((t) => t.key === active).panel}
    </AdminLayout>
  );
}

// Compat redirects so old bookmarks keep working
export function RedirectToEvents()        { return <Navigate to="/admin/ecosystem?tab=events" replace />; }
export function RedirectToCertifications(){ return <Navigate to="/admin/ecosystem?tab=certifications" replace />; }

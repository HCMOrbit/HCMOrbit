import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import NavHeader from "../../components/NavHeader";
import EcosystemSubpageHero from "../../components/ecosystem/EcosystemSubpageHero";
import { EventCard } from "../Ecosystem";
import { api } from "../../lib/api";

export default function EcosystemEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/ecosystem/events")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items;
        if (!cancelled) setEvents(Array.isArray(items) ? items : []);
      })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9]" data-testid="ecosystem-events-page">
      <NavHeader />
      <EcosystemSubpageHero
        eyebrow="UPCOMING EVENTS"
        title="Workday community events"
        description="RUGs, conferences, and webinars — every gathering across the Workday ecosystem in one place."
        current="Events"
      />
      <main className="max-w-[1200px] mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#0D9373]" strokeWidth={2} />
            <h2 className="font-heading text-xl font-semibold text-[#0A1628] leading-none">
              All events
            </h2>
          </div>
          {!loading && (
            <span className="text-sm text-[#64748B]" data-testid="events-count">
              {events.length} {events.length === 1 ? "event" : "events"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-[#64748B] py-12 text-center" data-testid="events-loading">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div
            className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center"
            data-testid="events-empty"
          >
            <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B]">No upcoming events right now. Check back soon.</p>
          </div>
        ) : (
          <div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            data-testid="events-list"
          >
            {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </div>
        )}
      </main>
    </div>
  );
}

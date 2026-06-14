import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Check, MessageSquare, Award, ArrowUp, AtSign, Shield } from "lucide-react";
import NavHeader from "../components/NavHeader";
import { api, timeAgo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { loginHref } from "../lib/redirect";

const ICONS = {
  answer: MessageSquare,
  vote: ArrowUp,
  accepted: Award,
  mention: AtSign,
  comment: MessageSquare,
  report_actioned: Shield,
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const load = () => {
    api.get("/notifications")
      .then((r) => setItems(r.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate(loginHref(location)); return; }
    load();
  }, [user, authLoading, navigate, location]);

  const markRead = async () => {
    try {
      await api.post("/notifications/mark-read");
      load();
    } catch {
      // ignore
    }
  };

  const today = items.filter((i) => Date.now() - new Date(i.created_at).getTime() < 86400000);
  const earlier = items.filter((i) => Date.now() - new Date(i.created_at).getTime() >= 86400000);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="notifications-page">
      <NavHeader />
      <div className="max-w-[800px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Notifications</h1>
          {items.some((i) => !i.is_read) && (
            <button onClick={markRead} className="text-sm text-[#0D9373] hover:underline font-medium" data-testid="mark-read-btn">
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#94A3B8]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-16 text-center" data-testid="no-notifications">
            <Check className="w-10 h-10 mx-auto text-[#16A34A] mb-3" />
            <h3 className="font-heading font-semibold text-[#0A1628]">You're all caught up.</h3>
            <p className="text-sm text-[#64748B] mt-1">No new notifications. We'll let you know when there's activity.</p>
          </div>
        ) : (
          <>
            {today.length > 0 && <Section title="Today" items={today} />}
            {earlier.length > 0 && <Section title="Earlier" items={earlier} />}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-2 px-1">{title}</div>
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        {items.map((n, i) => {
          const Icon = ICONS[n.type] || MessageSquare;
          return (
            <Link
              key={n.id} to={n.link || "#"}
              data-testid={`notif-${n.id}`}
              className={`flex items-start gap-3 px-5 py-4 hover:bg-[#F8FAFC] ${i !== items.length - 1 ? "border-b border-[#E2E8F0]" : ""} ${!n.is_read ? "bg-[#0D9373]/5" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.is_read ? "bg-[#0D9373] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#0F172A]">{n.message}</div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#0D9373] mt-2" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

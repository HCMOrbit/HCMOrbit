import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import NavHeader from "../components/NavHeader";
import GroupBadge from "../components/GroupBadge";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { safeRedirectTarget, loginHref } from "../lib/redirect";
import { toast } from "sonner";

const WORKDAY_MODULES = ["Core HCM","Compensation","Benefits","Absence","Recruiting","Talent","Payroll","Security","Integrations","Reporting","Financials"];

export default function Onboarding() {
  const { user, refresh, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = safeRedirectTarget(location.search);
  const [groupType, setGroupType] = useState("");
  const [modules, setModules] = useState([]);
  const [years, setYears] = useState("");
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate(loginHref(location));
    else if (user.onboarded) navigate(redirectTo || "/community");
  }, [user, authLoading, navigate, location, redirectTo]);

  const submit = async (e) => {
    e.preventDefault();
    if (!groupType) { toast.error("Please choose a group."); return; }
    setLoading(true);
    try {
      await api.post("/profile/setup", {
        group_type: groupType,
        workday_modules: modules,
        years_experience: years ? parseInt(years) : null,
        bio: bio || null,
        company_name: company || null,
      });
      await refresh();
      toast.success("Profile set up. Welcome to HCMOrbit.");
      navigate(redirectTo || "/community");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="onboarding-page">
      <NavHeader />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="font-heading text-3xl font-semibold text-[#0A1628]">Finish your profile</h1>
        <p className="text-sm text-[#64748B] mt-2">Tell the community who you are. Edit anytime.</p>

        <form onSubmit={submit} className="mt-8 bg-white border border-[#E2E8F0] rounded-xl p-7 flex flex-col gap-6">
          <div>
            <label className="text-xs font-medium text-[#475569]">Choose your group *</label>
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              {[
                { id: "aspirant", title: "Aspirant", desc: "0–3 yrs Workday" },
                { id: "practitioner", title: "Practitioner", desc: "3+ yrs Workday" },
                { id: "employer", title: "Employer", desc: "Hiring / firm" },
              ].map((g) => (
                <button
                  type="button" key={g.id} onClick={() => setGroupType(g.id)}
                  data-testid={`onboard-group-${g.id}`}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${groupType === g.id ? "border-[#0D9373] shadow-sm" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                >
                  <GroupBadge group={g.id} />
                  <div className="font-medium text-sm text-[#0A1628] mt-2">{g.title}</div>
                  <div className="text-xs text-[#64748B] mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#475569]">Workday modules</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WORKDAY_MODULES.map((m) => {
                const on = modules.includes(m);
                return (
                  <button
                    type="button" key={m}
                    onClick={() => setModules(on ? modules.filter((x) => x !== m) : [...modules, m])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#0D9373] text-white border-[#0D9373]" : "bg-white text-[#475569] border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[#475569]">Years of experience</label>
              <input type="number" min="0" value={years} onChange={(e) => setYears(e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm" />
            </div>
            {groupType === "employer" && (
              <div>
                <label className="text-xs font-medium text-[#475569]">Company name</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm" />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-[#475569]">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1.5 w-full min-h-[100px] px-3 py-2 rounded-md border border-[#E2E8F0] focus:border-[#0D9373] outline-none text-sm" placeholder="2–3 sentences about your Workday journey." />
          </div>

          <button type="submit" disabled={loading} className="py-2.5 rounded-md bg-[#0D9373] hover:bg-[#0b7c61] text-white font-medium text-sm disabled:opacity-60" data-testid="onboard-submit">
            {loading ? "Saving..." : "Finish setup"} <ArrowRight className="inline w-4 h-4 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";
import CommunityHome from "@/pages/CommunityHome";
import PostDetail from "@/pages/PostDetail";
import NewPost from "@/pages/NewPost";
import SpacePage from "@/pages/SpacePage";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import Bookmarks from "@/pages/Bookmarks";
import Search from "@/pages/Search";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminMembers from "@/pages/admin/AdminMembers";
import AdminPosts from "@/pages/admin/AdminPosts";
import AdminReported from "@/pages/admin/AdminReported";
import AdminSpaces from "@/pages/admin/AdminSpaces";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminKnowledgeBase from "@/pages/admin/AdminKnowledgeBase";
import AdminEmailPreviews from "@/pages/admin/AdminEmailPreviews";
import AdminEcosystem, { RedirectToEvents, RedirectToCertifications } from "@/pages/admin/AdminEcosystem";
import AdminEcosystemIntelligence from "@/pages/admin/AdminEcosystemIntelligence";
import AdminContact from "@/pages/admin/AdminContact";
import EcosystemIndustryPulse from "@/pages/ecosystem/EcosystemIndustryPulse";
import EcosystemIndustryPulseCompare from "@/pages/ecosystem/EcosystemIndustryPulseCompare";
import EcosystemEvents from "@/pages/ecosystem/EcosystemEvents";
import EcosystemNews from "@/pages/ecosystem/EcosystemNews";
import EcosystemCertifications from "@/pages/ecosystem/EcosystemCertifications";
import KBHome from "@/pages/kb/KBHome";
import KBCategory from "@/pages/kb/KBCategory";
import KBSearch from "@/pages/kb/KBSearch";
import KBGlobalSearch from "@/pages/kb/KBGlobalSearch";
import KBDoc from "@/pages/kb/KBDoc";
import NewKBDoc from "@/pages/kb/NewKBDoc";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Cookies from "@/pages/Cookies";
import WhyHCMOrbit from "@/pages/WhyHCMOrbit";
import CareerNavigator from "@/careerNavigator/CareerNavigator";
import Connect from "@/pages/Connect";
import CookieBanner from "@/components/CookieBanner";
import SiteFooter from "@/components/SiteFooter";
import ScrollToHash from "@/components/ScrollToHash";
import AuthCallback from "@/components/AuthCallback";
import AskOrbitWidget from "@/components/AskOrbitWidget";
import KBRefResolver from "@/pages/kb/KBRefResolver";
import DocwrightLanding from "@/pages/docwright/DocwrightLanding";
import DocwrightResult from "@/pages/docwright/DocwrightResult";
import DocwrightHistory from "@/pages/docwright/DocwrightHistory";

function AppRoutes() {
  const location = useLocation();

  // Scroll to top on every route change so KB doc clicks (and any other
  // navigation) always open at the page top — unless the URL has a hash
  // (e.g. TOC anchor jumps) where we let the browser handle the scroll.
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  // OAuth callback: intercept session_id in hash before any other routing
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/community" element={<CommunityHome />} />
      <Route path="/community/new-post" element={<NewPost />} />
      <Route path="/community/posts/:id" element={<PostDetail />} />
      <Route path="/community/spaces/:slug" element={<SpacePage />} />
      <Route path="/profile/:username" element={<Profile />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
      <Route path="/search" element={<Search />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/members" element={<AdminMembers />} />
      <Route path="/admin/posts" element={<AdminPosts />} />
      <Route path="/admin/reported" element={<AdminReported />} />
      <Route path="/admin/spaces" element={<AdminSpaces />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="/admin/knowledge-base" element={<AdminKnowledgeBase />} />
      <Route path="/admin/email-previews" element={<AdminEmailPreviews />} />
      <Route path="/admin/ecosystem" element={<AdminEcosystem />} />
      <Route path="/admin/ecosystem-intelligence" element={<AdminEcosystemIntelligence />} />
      <Route path="/admin/ecosystem-events" element={<RedirectToEvents />} />
      <Route path="/admin/ecosystem-certifications" element={<RedirectToCertifications />} />
      <Route path="/admin/contact" element={<AdminContact />} />
      <Route path="/knowledge-base" element={<KBHome />} />
      <Route path="/knowledge-base/by-ref/:referenceId" element={<KBRefResolver />} />
      <Route path="/knowledge-base/search" element={<KBGlobalSearch />} />
      <Route path="/knowledge-base/new" element={<NewKBDoc />} />
      <Route path="/knowledge-base/:slug" element={<KBCategory />} />
      <Route path="/knowledge-base/:slug/search" element={<KBSearch />} />
      <Route path="/knowledge-base/:slug/:docId" element={<KBDoc />} />
      <Route path="/docwright" element={<DocwrightLanding />} />
      <Route path="/docwright/history" element={<DocwrightHistory />} />
      <Route path="/docwright/result/:docId" element={<DocwrightResult />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/why-hcmorbit" element={<WhyHCMOrbit />} />
      <Route path="/ecosystem" element={<Navigate to="/ecosystem/industry-pulse" replace />} />
      <Route path="/ecosystem/industry-pulse" element={<EcosystemIndustryPulse />} />
      <Route path="/ecosystem/industry-pulse/compare" element={<EcosystemIndustryPulseCompare />} />
      <Route path="/ecosystem/upcoming-events" element={<EcosystemEvents />} />
      <Route path="/ecosystem/community-news" element={<EcosystemNews />} />
      <Route path="/ecosystem/events" element={<Navigate to="/ecosystem/upcoming-events" replace />} />
      <Route path="/ecosystem/news" element={<Navigate to="/ecosystem/community-news" replace />} />
      <Route path="/ecosystem/certifications" element={<EcosystemCertifications />} />
      <Route path="/about/why-hcmorbit" element={<WhyHCMOrbit />} />
      <Route path="/career-hub" element={<CareerNavigator />} />
      <Route path="/connect" element={<Connect />} />
    </Routes>
  );
}

function GlobalFooter() {
  const location = useLocation();
  const path = location.pathname;
  // Hide footer on auth flows, OAuth callback, and the entire admin area
  const hidden =
    ["/login", "/register", "/onboarding"].includes(path) ||
    path === "/admin" ||
    path.startsWith("/admin/");
  if (hidden) return null;
  return <SiteFooter />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToHash />
        <AppRoutes />
        <GlobalFooter />
        <CookieBanner />
        <AskOrbitWidget />
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

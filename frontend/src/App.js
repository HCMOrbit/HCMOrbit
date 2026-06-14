import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
import KBHome from "@/pages/kb/KBHome";
import KBCategory from "@/pages/kb/KBCategory";
import KBSearch from "@/pages/kb/KBSearch";
import KBDoc from "@/pages/kb/KBDoc";
import NewKBDoc from "@/pages/kb/NewKBDoc";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Cookies from "@/pages/Cookies";
import WhyHCMOrbit from "@/pages/WhyHCMOrbit";
import CookieBanner from "@/components/CookieBanner";
import SiteFooter from "@/components/SiteFooter";
import AuthCallback from "@/components/AuthCallback";

function AppRoutes() {
  const location = useLocation();
  // OAuth callback: intercept session_id in hash before any other routing
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
      <Route path="/knowledge-base" element={<KBHome />} />
      <Route path="/knowledge-base/new" element={<NewKBDoc />} />
      <Route path="/knowledge-base/:slug" element={<KBCategory />} />
      <Route path="/knowledge-base/:slug/search" element={<KBSearch />} />
      <Route path="/knowledge-base/:slug/:docId" element={<KBDoc />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/why-hcmorbit" element={<WhyHCMOrbit />} />
      <Route path="/about/why-hcmorbit" element={<WhyHCMOrbit />} />
    </Routes>
  );
}

function GlobalFooter() {
  const location = useLocation();
  // Hide footer on auth flows and OAuth callback for a focused experience
  const hidden = ["/login", "/register", "/onboarding"].includes(location.pathname);
  if (hidden) return null;
  return <SiteFooter />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ImpersonationBanner />
        <AppRoutes />
        <GlobalFooter />
        <CookieBanner />
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

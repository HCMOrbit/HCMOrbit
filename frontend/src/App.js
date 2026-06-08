import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
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
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

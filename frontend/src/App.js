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

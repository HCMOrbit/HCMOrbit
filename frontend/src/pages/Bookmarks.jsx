import React, { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import NavHeader from "../components/NavHeader";
import CommunityLayout from "../components/CommunityLayout";
import PostCard from "../components/PostCard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";

export default function Bookmarks() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    api.get("/bookmarks")
      .then((r) => setPosts(r.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="bookmarks-page">
      <NavHeader />
      <CommunityLayout>
        <div className="mb-5 flex items-center gap-3">
          <Bookmark className="w-6 h-6 text-[#0D9373]" />
          <div>
            <h1 className="font-heading text-2xl font-semibold text-[#0A1628]">Bookmarks</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Posts you've saved to read or revisit later.</p>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-16 text-sm text-[#94A3B8]">Loading bookmarks...</div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center" data-testid="bookmarks-empty">
            <Bookmark className="w-10 h-10 mx-auto text-[#94A3B8] mb-3" />
            <h3 className="font-heading font-semibold text-[#0A1628]">No bookmarks yet.</h3>
            <p className="text-sm text-[#64748B] mt-1">Tap the bookmark icon on any post to save it here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3" data-testid="bookmarks-list">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </CommunityLayout>
    </div>
  );
}

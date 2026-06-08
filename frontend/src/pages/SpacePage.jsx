import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, Network, Shield, BarChart3, CircleDollarSign, Wallet, Landmark, Coffee } from "lucide-react";
import NavHeader from "../components/NavHeader";
import CommunityLayout from "../components/CommunityLayout";
import PostCard from "../components/PostCard";
import { api } from "../lib/api";

const ICON_MAP = { Users, Network, Shield, BarChart3, CircleDollarSign, Wallet, Landmark, Coffee };

export default function SpacePage() {
  const { slug } = useParams();
  const [space, setSpace] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/spaces/${slug}`),
      api.get(`/posts?space=${slug}&limit=20`),
    ]).then(([s, p]) => {
      setSpace(s.data);
      setPosts(p.data.posts);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  const Icon = space?.icon ? (ICON_MAP[space.icon] || Users) : Users;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="space-page">
      <NavHeader />
      <CommunityLayout>
        {loading ? <div className="text-center py-16 text-[#94A3B8]">Loading...</div> : space && (
          <>
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 mb-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-[#0A1628] flex items-center justify-center shrink-0">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="font-heading text-2xl font-semibold text-[#0A1628]" data-testid="space-name">{space.name}</h1>
                  <p className="text-sm text-[#64748B] mt-1">{space.description}</p>
                  <div className="mt-3 flex gap-4 text-xs text-[#64748B]">
                    <span><span className="counter font-semibold text-[#0F172A]">{space.post_count}</span> posts</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {posts.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center text-sm text-[#64748B]">
                  Be the first to post in {space.name}. Ask a question or share what you know.
                </div>
              ) : posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          </>
        )}
      </CommunityLayout>
    </div>
  );
}

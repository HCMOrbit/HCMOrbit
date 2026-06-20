import React from "react";
import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="bg-[#0A1628] border-t border-white/10 text-white/70" data-testid="site-footer">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-[#0D9373]" />
              </div>
              <span className="font-heading font-bold text-base text-white tracking-tight">HCMOrbit</span>
            </div>
            <p className="text-xs leading-relaxed text-white/50 max-w-xs">
              The independent community where Workday professionals learn, solve, and grow together.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-white font-semibold mb-4">Company</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/why-hcmorbit" className="hover:text-[#0D9373] transition-colors" data-testid="footer-why-hcmorbit">Why HCMOrbit Exists</Link></li>
              <li><Link to="/connect" className="hover:text-[#0D9373] transition-colors" data-testid="footer-connect">Connect</Link></li>
              <li><Link to="/register?founder=1" className="hover:text-[#0D9373] transition-colors">Become a Founding Member</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-white font-semibold mb-4">Community</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/community" className="hover:text-[#0D9373] transition-colors">Discussions</Link></li>
              <li><Link to="/knowledge-base" className="hover:text-[#0D9373] transition-colors">Knowledge Base</Link></li>
              <li><Link to="/register" className="hover:text-[#0D9373] transition-colors">Join Community</Link></li>
              <li><Link to="/login" className="hover:text-[#0D9373] transition-colors">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-white font-semibold mb-4">Legal</div>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/privacy" className="hover:text-[#0D9373] transition-colors" data-testid="footer-privacy">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-[#0D9373] transition-colors" data-testid="footer-terms">Terms of Use</Link></li>
              <li><Link to="/cookies" className="hover:text-[#0D9373] transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-xs text-white/40 text-center">
          © 2026 HCMOrbit · Independent community for the HCM ecosystem
        </div>
      </div>
    </footer>
  );
}

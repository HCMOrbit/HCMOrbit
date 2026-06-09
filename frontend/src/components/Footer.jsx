import React from "react";
import { Link } from "react-router-dom";
import { Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0A1628] text-white mt-auto" data-testid="footer">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center"><div className="w-3.5 h-3.5 rounded-full bg-[#0D9373]" /></div>
            <span className="font-heading font-bold text-lg">HCMOrbit</span>
          </Link>
          <div className="mt-3 text-sm text-white/80">Where HCM professionals connect, learn, and rise.</div>
          <div className="mt-2 text-xs text-white/50 leading-relaxed">The independent community for Workday practitioners, aspirants, and employers.</div>
          <a href="#" aria-label="LinkedIn" className="mt-4 inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <Linkedin className="w-4 h-4" />
          </a>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#0D9373] mb-3">Platform</div>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link to="/community" className="text-white/80 hover:text-white">Community</Link></li>
            <li><Link to="/knowledge-base" className="text-white/80 hover:text-white">Knowledge Base</Link></li>
            <li><Link to="/knowledge-base" className="text-white/80 hover:text-white">Browse by Module</Link></li>
            <li><Link to="/knowledge-base/new" className="text-white/80 hover:text-white">Contribute a Document</Link></li>
            <li><Link to="/register" className="text-white/80 hover:text-white">Join HCMOrbit</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#0D9373] mb-3">Company</div>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link to="/privacy" className="text-white/80 hover:text-white" data-testid="footer-privacy">Privacy Policy</Link></li>
            <li><Link to="/terms" className="text-white/80 hover:text-white" data-testid="footer-terms">Terms of Service</Link></li>
            <li><Link to="/cookies" className="text-white/80 hover:text-white" data-testid="footer-cookies">Cookie Policy</Link></li>
            <li><a href="mailto:support@hcmorbit.com" className="text-white/80 hover:text-white">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B]">
          <span>© 2025 HCMOrbit. All rights reserved.</span>
          <a href="mailto:support@hcmorbit.com" className="hover:text-white">support@hcmorbit.com</a>
        </div>
      </div>
    </footer>
  );
}

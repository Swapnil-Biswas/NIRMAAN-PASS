import React from 'react';
import Link from 'next/link';
import { Instagram, Linkedin, Share2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-nirmaan-black text-white py-6 border-t border-nirmaan-black mt-auto no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-display text-lg font-black tracking-tight hover:text-nirmaan-amber transition-colors">
              nirmaan<span className="text-nirmaan-red">.</span>
            </Link>
            <span className="text-white/60 font-medium">© 2026 NIRMAAN Hackathon.</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-[11px] text-white/70 text-center">
            <span>Organized by</span>
            <div className="flex items-center gap-1.5 font-bold text-white">
              <img
                src="/organizers/coding-club.png"
                alt="Coding Club BMSIT"
                className="w-4 h-4 rounded-full object-cover bg-black flex-shrink-0"
              />
              <span className="hover:text-nirmaan-amber transition-colors">Coding Club</span>
              <span>&amp;</span>
              <img
                src="/organizers/alterino.jpg"
                alt="Alterino BMSIT"
                className="w-4 h-4 rounded-full object-cover bg-black flex-shrink-0"
              />
              <span className="hover:text-nirmaan-orange transition-colors">Alterino</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-6 font-bold text-white/80">
          <Link href="/pass" className="hover:text-nirmaan-amber transition-colors">
            My Pass
          </Link>
          <Link href="/dashboard" className="hover:text-nirmaan-amber transition-colors">
            Dashboard
          </Link>
          <Link href="/event-info" className="hover:text-nirmaan-amber transition-colors">
            Event Info
          </Link>

          {/* Socials with Instagram and LinkedIn icons attached */}
          <div className="flex items-center gap-1.5 sm:gap-2 sm:pl-2 sm:border-l sm:border-white/20">
            <Link
              href="/socials"
              className="hover:text-nirmaan-amber transition-colors flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-nirmaan-orange" />
              <span>Socials</span>
            </Link>

            <div className="flex items-center gap-1.5 ml-1">
              <a
                href="https://www.instagram.com/codingclub_bmsit/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full bg-white/10 hover:bg-nirmaan-red/90 hover:text-white text-white/80 transition-all hover:scale-110"
                aria-label="Instagram"
                title="Follow Coding Club on Instagram"
              >
                <Instagram className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://www.linkedin.com/in/codingclub-bmsit/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full bg-white/10 hover:bg-nirmaan-blue hover:text-white text-white/80 transition-all hover:scale-110"
                aria-label="LinkedIn"
                title="Connect on LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QrCode, LayoutDashboard, Info, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const isLinkActive = (path: string) => pathname === path || (path !== '/' && pathname?.startsWith(path));

  return (
    <header className="w-full bg-nirmaan-cream border-b border-nirmaan-black/10 sticky top-0 z-40 backdrop-blur-md bg-nirmaan-cream/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo Wordmark */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="font-display text-3xl font-black tracking-tighter text-nirmaan-black flex items-baseline">
            nirmaan<span className="text-nirmaan-red font-black text-4xl leading-none">.</span>
          </div>
          <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black font-extrabold text-[11px] px-2.5 py-0.5 ml-1 hidden sm:inline-flex">
            PASS
          </span>
        </Link>

        {/* Live Hackathon Pill */}
        <div className="hidden md:flex items-center gap-2 bg-nirmaan-cream-card px-3.5 py-1.5 rounded-full border border-nirmaan-black/10 shadow-sm">
          <span className="live-dot"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-nirmaan-black">
            NIRMAAN 2026 LIVE
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/pass"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/pass')
                ? 'bg-nirmaan-blue text-white shadow-sm'
                : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Pass</span>
          </Link>

          <Link
            href="/dashboard"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/dashboard')
                ? 'bg-nirmaan-amber text-nirmaan-black shadow-sm'
                : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/event-info"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/event-info')
                ? 'bg-nirmaan-purple text-white shadow-sm'
                : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Event Info</span>
          </Link>

          <div className="h-6 w-px bg-nirmaan-black/15 mx-1 hidden sm:block"></div>

          <Link
            href="/admin/scanner"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/admin/scanner')
                ? 'bg-nirmaan-red text-white shadow-sm'
                : 'bg-nirmaan-black text-white hover:bg-nirmaan-black/80'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scanner</span>
          </Link>

          <Link
            href="/admin/dashboard"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/admin/dashboard') || isLinkActive('/admin/teams') || isLinkActive('/admin/announcements')
                ? 'bg-nirmaan-green-dark text-white shadow-sm'
                : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

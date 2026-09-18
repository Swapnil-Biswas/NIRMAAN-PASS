'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Zap, Megaphone, Lock, LogOut, Shield } from 'lucide-react';

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [locking, setLocking] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const handleLock = async () => {
    setLocking(true);
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {}
    router.refresh();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-nirmaan-black text-white border-b-2 border-nirmaan-black/80 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="flex items-center gap-2 group">
            <span className="font-display text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-nirmaan-amber transition-colors">
              nirmaan<span className="text-nirmaan-amber">.</span>
            </span>
          </Link>
          <span className="nirmaan-pill bg-nirmaan-green-dark text-white text-[10px] font-black border border-white/20 py-0.5 px-2.5">
            <Shield className="w-3 h-3 text-nirmaan-green-bright" />
            <span className="hidden xs:inline">OPERATIONS DESK</span>
          </span>
        </div>

        {/* Admin Navigation */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/admin/dashboard"
            className={`nirmaan-pill text-xs transition-colors ${
              isActive('/admin/dashboard')
                ? 'bg-white text-nirmaan-black shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Event Stats</span>
          </Link>

          <Link
            href="/admin/scanner"
            className={`nirmaan-pill text-xs transition-colors ${
              isActive('/admin/scanner')
                ? 'bg-nirmaan-red text-white shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-nirmaan-amber" />
            <span className="hidden sm:inline">Queue Scanner</span>
          </Link>

          <Link
            href="/admin/announcements"
            className={`nirmaan-pill text-xs transition-colors ${
              isActive('/admin/announcements')
                ? 'bg-nirmaan-amber text-nirmaan-black font-bold shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Broadcast</span>
          </Link>

          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block"></div>

          {/* Lock / Exit Admin */}
          <button
            onClick={handleLock}
            disabled={locking}
            className="nirmaan-pill bg-white/10 hover:bg-nirmaan-red hover:text-white text-white/90 text-xs font-bold transition-colors ml-1"
            title="Lock Console and Exit"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{locking ? 'Locking...' : 'Lock'}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

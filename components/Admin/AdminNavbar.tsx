'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Zap, Megaphone, Calendar, Lock, Shield } from 'lucide-react';

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

  const navItems = [
    {
      href: '/admin/scanner',
      label: 'Scanner',
      icon: Zap,
      activeClass: 'bg-nirmaan-red text-white',
    },
    {
      href: '/admin/dashboard',
      label: 'Event Stats',
      icon: BarChart3,
      activeClass: 'bg-white text-nirmaan-black',
    },
    {
      href: '/admin/announcements',
      label: 'Broadcast',
      icon: Megaphone,
      activeClass: 'bg-nirmaan-amber text-nirmaan-black',
    },
    {
      href: '/admin/schedule',
      label: 'Schedule',
      icon: Calendar,
      activeClass: 'bg-nirmaan-blue text-white',
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-nirmaan-black border-b-2 border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-4">
        {/* Brand & Admin Badge */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/admin/scanner" className="flex items-center gap-2 group">
            <span className="font-display text-2xl sm:text-[28px] font-black tracking-tight text-white group-hover:text-nirmaan-amber transition-colors">
              nirmaan<span className="text-nirmaan-red text-3xl sm:text-[32px] leading-none">.</span>
            </span>
          </Link>
          <span className="nirmaan-pill bg-nirmaan-green-dark text-white text-[9px] sm:text-[10px] font-black py-1 px-2 sm:px-2.5 border border-nirmaan-green-bright/30">
            <Shield className="w-3 h-3 text-nirmaan-green-bright" />
            <span className="hidden sm:inline">ADMIN</span>
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nirmaan-pill text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? `${item.activeClass} shadow-md ring-1 ring-white/20`
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="h-6 w-px bg-white/15 mx-1.5 flex-shrink-0" />

          {/* Lock / Exit */}
          <button
            onClick={handleLock}
            disabled={locking}
            className="nirmaan-pill bg-white/10 hover:bg-nirmaan-red hover:text-white text-white/80 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50"
            title="Lock Console and Exit"
          >
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            {locking ? 'Locking...' : 'Lock'}
          </button>
        </nav>
      </div>
    </header>
  );
}

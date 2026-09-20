'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Zap, Megaphone, Calendar, Lock, Shield, Menu, X } from 'lucide-react';

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLock = async () => {
    setLocking(true);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('nirmaan_admin_active_tab');
    }
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {}
    router.refresh();
    router.push('/');
  };

  const navItems = [
    {
      href: '/admin/scanner',
      label: 'Queue Scanner',
      icon: Zap,
      activeClass: 'bg-nirmaan-red text-white',
    },
    {
      href: '/admin/dashboard',
      label: 'Event Stats & Teams',
      icon: BarChart3,
      activeClass: 'bg-white text-nirmaan-black',
    },
    {
      href: '/admin/announcements',
      label: 'Broadcast Feed',
      icon: Megaphone,
      activeClass: 'bg-nirmaan-amber text-nirmaan-black',
    },
    {
      href: '/admin/schedule',
      label: 'Event Schedule',
      icon: Calendar,
      activeClass: 'bg-nirmaan-blue text-white',
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-nirmaan-black border-b-2 border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-3">
          {/* Brand & Admin Badge */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Link href="/admin/scanner" className="flex items-center gap-1.5 group">
              <span className="font-display text-2xl sm:text-[28px] font-black tracking-tight text-white group-hover:text-nirmaan-amber transition-colors">
                nirmaan<span className="text-nirmaan-red text-3xl sm:text-[32px] leading-none">.</span>
              </span>
            </Link>
            <span className="nirmaan-pill bg-nirmaan-green-dark text-white text-[9px] sm:text-[10px] font-black py-0.5 px-2 sm:px-2.5 border border-nirmaan-green-bright/30">
              <Shield className="w-3 h-3 text-nirmaan-green-bright" />
              <span className="hidden xs:inline">ADMIN</span>
            </span>
          </div>

          {/* Desktop Navigation (> lg) */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nirmaan-pill text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? `${item.activeClass} shadow-md ring-1 ring-white/20`
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Divider */}
            <div className="h-6 w-px bg-white/15 mx-1 flex-shrink-0" />

            {/* Lock / Exit */}
            <button
              onClick={handleLock}
              disabled={locking}
              className="nirmaan-pill bg-white/10 hover:bg-nirmaan-red hover:text-white text-white/80 text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50"
              title="Lock Console and Exit"
            >
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{locking ? 'Locking...' : 'Lock'}</span>
            </button>
          </nav>

          {/* Mobile Menu Button (<= lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/admin/scanner"
              className={`nirmaan-pill py-1.5 px-2.5 text-xs font-black ${
                isActive('/admin/scanner') ? 'bg-nirmaan-red text-white' : 'bg-white/10 text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-nirmaan-amber" />
              <span className="text-[11px]">Scanner</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Admin Menu"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Admin Mobile Sidebar / Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Slide-out Sidebar Drawer */}
          <aside className="relative ml-auto w-[290px] sm:w-[320px] max-w-[85vw] h-full bg-nirmaan-black text-white border-l-2 border-white/15 shadow-2xl flex flex-col justify-between p-6 z-50 animate-in slide-in-from-right duration-300 overflow-y-auto">
            {/* Top Brand & Close */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-black text-white">
                    nirmaan<span className="text-nirmaan-red text-3xl leading-none">.</span>
                  </span>
                  <span className="nirmaan-pill bg-nirmaan-green-dark text-white text-[9px] font-black py-0.5 px-2">
                    ADMIN
                  </span>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close Menu"
                  className="p-1.5 rounded-xl border border-white/20 hover:bg-white hover:text-nirmaan-black transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Admin Navigation Links */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1">
                  Organizer Modules
                </span>

                <div className="space-y-1.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between p-3.5 rounded-xl font-display text-xs font-black uppercase border transition-all ${
                          active
                            ? `${item.activeClass} border-white/30 shadow-md`
                            : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        <span className="text-xs">➔</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <button
                onClick={handleLock}
                disabled={locking}
                className="w-full nirmaan-btn bg-nirmaan-red text-white py-3 text-xs font-black flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>{locking ? 'LOCKING...' : 'LOCK CONSOLE & EXIT'}</span>
              </button>

              <div className="text-center text-[10px] font-bold uppercase text-white/30">
                OPERATIONS DESK • NIRMAAN 2026
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

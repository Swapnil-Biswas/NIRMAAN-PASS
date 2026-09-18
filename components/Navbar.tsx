'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QrCode, LayoutDashboard, Info, Share2, LogIn, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createClient();
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (!mounted) return;
          setIsLoggedIn(!!session);
          setUserEmail(session?.user?.email || null);
        })
        .catch(() => {
          // Ignore offline/network failure in getSession
        });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setIsLoggedIn(!!session);
        setUserEmail(session?.user?.email || null);
      });

      return () => {
        mounted = false;
        subscription?.unsubscribe();
      };
    } catch {
      return () => {
        mounted = false;
      };
    }
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    router.push('/');
    router.refresh();
  };

  const isLinkActive = (path: string) => pathname === path || (path !== '/' && pathname?.startsWith(path));

  return (
    <header className="w-full bg-nirmaan-cream border-b border-nirmaan-black/10 sticky top-0 z-40 backdrop-blur-md bg-nirmaan-cream/90 no-print">
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
        <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
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

          <Link
            href="/socials"
            className={`nirmaan-pill transition-colors ${
              isLinkActive('/socials')
                ? 'bg-nirmaan-orange text-white shadow-sm'
                : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Socials</span>
          </Link>



          {/* Auth Button */}
          <div className="h-6 w-px bg-nirmaan-black/15 mx-0.5 hidden sm:block"></div>

          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="nirmaan-pill bg-nirmaan-cream-card hover:bg-nirmaan-red/10 text-nirmaan-black border border-nirmaan-black/10 transition-colors"
              title={userEmail || 'Logout'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <Link
              href="/login"
              className={`nirmaan-pill transition-colors ${
                isLinkActive('/login') || isLinkActive('/activate')
                  ? 'bg-nirmaan-blue text-white shadow-sm'
                  : 'bg-nirmaan-cream-card hover:bg-nirmaan-blue/10 text-nirmaan-black border border-nirmaan-black/10'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  QrCode,
  LayoutDashboard,
  Info,
  LogIn,
  LogOut,
  Menu,
  X,
  Shield,
  KeyRound,
  Zap,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setIsLoggedIn(Boolean(data.loggedIn));
        setUserEmail(data.email || null);
      })
      .catch(() => {
        if (!mounted) return;
        setIsLoggedIn(false);
      });

    return () => {
      mounted = false;
    };
  }, [pathname]);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setIsLoggedIn(false);
    setUserEmail(null);
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const isLinkActive = (path: string) =>
    pathname === path || (path !== '/' && pathname?.startsWith(path));

  const navLinks = [
    {
      href: '/pass',
      label: 'My Pass',
      icon: QrCode,
      activeColor: 'bg-nirmaan-blue text-white shadow-sm',
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      activeColor: 'bg-nirmaan-amber text-nirmaan-black shadow-sm',
    },
    {
      href: '/event-info',
      label: 'Event Info',
      icon: Info,
      activeColor: 'bg-nirmaan-purple text-white shadow-sm',
    },
  ];

  return (
    <>
      <header className="w-full bg-nirmaan-cream border-b border-nirmaan-black/10 sticky top-0 z-40 backdrop-blur-md bg-nirmaan-cream/90 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Logo Wordmark */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="font-display text-2xl sm:text-3xl font-black tracking-tighter text-nirmaan-black flex items-baseline">
              nirmaan<span className="text-nirmaan-red font-black text-3xl sm:text-4xl leading-none">.</span>
            </div>
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black font-extrabold text-[10px] sm:text-[11px] px-2.5 py-0.5 ml-1">
              PASS
            </span>
          </Link>

          {/* Desktop Navigation (> md) */}
          <nav className="hidden md:flex items-center gap-1.5 sm:gap-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nirmaan-pill transition-colors ${
                    active
                      ? item.activeColor
                      : 'bg-nirmaan-cream-card hover:bg-nirmaan-black/5 text-nirmaan-black border border-nirmaan-black/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Auth Button */}
            <div className="h-6 w-px bg-nirmaan-black/15 mx-0.5" />

            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="nirmaan-pill bg-nirmaan-cream-card hover:bg-nirmaan-red/10 text-nirmaan-black border border-nirmaan-black/10 transition-colors"
                title={userEmail || 'Logout'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
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
                <span>Login</span>
              </Link>
            )}
          </nav>

          {/* Mobile Hamburger Button (<= md) */}
          <div className="flex md:hidden items-center gap-2">
            {/* Direct Pass Shortcut on mobile if logged in */}
            {isLoggedIn && (
              <Link
                href="/pass"
                className={`nirmaan-pill py-1.5 px-2.5 text-xs font-bold ${
                  isLinkActive('/pass')
                    ? 'bg-nirmaan-blue text-white'
                    : 'bg-white text-nirmaan-black border border-nirmaan-black/15'
                }`}
                title="My Pass"
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[11px]">Pass</span>
              </Link>
            )}

            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="p-2 rounded-xl bg-white border-2 border-nirmaan-black text-nirmaan-black hover:bg-nirmaan-cream transition-colors shadow-xs"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar / Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-nirmaan-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Slide-out Sidebar Drawer */}
          <aside className="relative ml-auto w-[290px] sm:w-[320px] max-w-[85vw] h-full bg-nirmaan-cream border-l-2 border-nirmaan-black shadow-2xl flex flex-col justify-between p-6 z-50 animate-in slide-in-from-right duration-300 overflow-y-auto">
            {/* Drawer Top Header */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-nirmaan-black/10">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-display text-2xl font-black tracking-tight text-nirmaan-black flex items-baseline"
                >
                  nirmaan<span className="text-nirmaan-red text-3xl leading-none">.</span>
                  <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[9px] font-black py-0 px-2 ml-1.5">
                    PASS
                  </span>
                </Link>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close Menu"
                  className="p-1.5 rounded-xl border border-nirmaan-black/15 hover:bg-nirmaan-black hover:text-white transition-colors text-nirmaan-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Session Info Card */}
              {isLoggedIn ? (
                <div className="p-3.5 rounded-2xl bg-white border border-nirmaan-black/15 shadow-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-nirmaan-black/50">
                      Active Account
                    </span>
                    <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[9px] font-black py-0.5 px-2">
                      LOGGED IN
                    </span>
                  </div>
                  <p className="font-bold text-xs text-nirmaan-black truncate">
                    {userEmail}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-nirmaan-blue/10 border border-nirmaan-blue/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-nirmaan-blue">
                    <Zap className="w-3.5 h-3.5" />
                    <span>NIRMAAN 2026 PASS</span>
                  </div>
                  <p className="text-[11px] font-medium text-nirmaan-black/75 leading-snug">
                    Sign in to access your digital team pass and meal tracking.
                  </p>
                </div>
              )}

              {/* Mobile Nav Links */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-nirmaan-black/50 px-1">
                  Navigation
                </span>

                <div className="space-y-1.5">
                  <Link
                    href="/pass"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl font-display text-sm font-black uppercase border transition-all ${
                      isLinkActive('/pass')
                        ? 'bg-nirmaan-blue text-white border-nirmaan-blue shadow-sm'
                        : 'bg-white hover:bg-nirmaan-cream text-nirmaan-black border-nirmaan-black/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode className="w-4 h-4" />
                      <span>MY PASS</span>
                    </div>
                    <span className="text-xs">➔</span>
                  </Link>

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl font-display text-sm font-black uppercase border transition-all ${
                      isLinkActive('/dashboard')
                        ? 'bg-nirmaan-amber text-nirmaan-black border-nirmaan-amber shadow-sm'
                        : 'bg-white hover:bg-nirmaan-cream text-nirmaan-black border-nirmaan-black/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>DASHBOARD</span>
                    </div>
                    <span className="text-xs">➔</span>
                  </Link>

                  <Link
                    href="/event-info"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl font-display text-sm font-black uppercase border transition-all ${
                      isLinkActive('/event-info')
                        ? 'bg-nirmaan-purple text-white border-nirmaan-purple shadow-sm'
                        : 'bg-white hover:bg-nirmaan-cream text-nirmaan-black border-nirmaan-black/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Info className="w-4 h-4" />
                      <span>EVENT INFO</span>
                    </div>
                    <span className="text-xs">➔</span>
                  </Link>

                  {!isLoggedIn && (
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl font-display text-sm font-black uppercase border transition-all ${
                        isLinkActive('/register')
                          ? 'bg-nirmaan-black text-white border-nirmaan-black shadow-sm'
                          : 'bg-white hover:bg-nirmaan-cream text-nirmaan-black border-nirmaan-black/15'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <KeyRound className="w-4 h-4 text-nirmaan-amber" />
                        <span>REGISTER TEAM</span>
                      </div>
                      <span className="text-xs">➔</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-6 border-t border-nirmaan-black/10 space-y-4">
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="w-full nirmaan-btn bg-nirmaan-red/10 hover:bg-nirmaan-red hover:text-white text-nirmaan-red border border-nirmaan-red/30 py-3 text-xs font-black flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>LOGOUT</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full nirmaan-btn nirmaan-btn-primary py-3 text-xs font-black flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  <span>SIGN IN TO PASS</span>
                </Link>
              )}

              <div className="text-center text-[10px] font-bold uppercase text-nirmaan-black/40">
                NIRMAAN 2026 • 25-HOUR HACKATHON
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

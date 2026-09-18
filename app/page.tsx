import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PassCard from '@/components/TeamQR/PassCard';
import { findTeamByToken, getTeamMembers, getAnnouncements, getEventStatistics } from '@/lib/data/store';
import { QrCode, LayoutDashboard, Info, ShieldCheck, ArrowRight, Sparkles, Utensils, Coffee, Zap } from 'lucide-react';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const defaultTeam = await findTeamByToken('nirmaan_alpha_9281a');
  const members = defaultTeam ? await getTeamMembers(defaultTeam.id) : [];
  const announcements = await getAnnouncements(true);
  const stats = await getEventStatistics();

  return (
    <div className="min-h-screen flex flex-col bg-nirmaan-cream">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-nirmaan-black text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-nirmaan-amber" />
            DIGITAL PARTICIPANT PASS & EVENT OPERATIONS
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-black uppercase text-nirmaan-black tracking-tight leading-[0.95] mb-6">
            ONE TEAM<span className="text-nirmaan-red">.</span><br />
            ONE QR<span className="text-nirmaan-amber">.</span><br />
            ONE PASS<span className="text-nirmaan-blue">.</span>
          </h1>

          <p className="text-base sm:text-lg font-medium text-nirmaan-black/80 max-w-2xl mx-auto leading-relaxed">
            Welcome to <strong>NIRMAAN 2026</strong>. Use your digital team pass for event-day on-desk registration, breakfast, lunch, dinner, and unlimited coffee/tea.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8">
            <Link
              href="/pass"
              className="nirmaan-btn nirmaan-btn-primary text-sm px-7 py-3.5 font-black shadow-lg"
            >
              <QrCode className="w-4 h-4" />
              VIEW MY PASS
            </Link>

            <Link
              href="/admin/scanner"
              className="nirmaan-btn nirmaan-btn-dark text-sm px-7 py-3.5 font-black shadow-lg"
            >
              <Zap className="w-4 h-4 text-nirmaan-amber" />
              EVENT SCANNER
            </Link>
          </div>
        </div>

        {/* Live Grid: Digital Pass Preview & Live Event Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Left Column: Digital Pass Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-black uppercase tracking-widest text-nirmaan-black/70">
                ACTIVE TEAM PASS (DEMO VIEW)
              </span>
              <Link href="/pass" className="text-xs font-bold text-nirmaan-blue hover:underline flex items-center gap-1">
                Full Pass View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {defaultTeam && <PassCard team={defaultTeam} members={members} />}
          </div>

          {/* Right Column: Live Event Broadcast & Stats summary */}
          <div className="lg:col-span-6 space-y-6">
            {/* Quick Live Stats Pill Box */}
            <div className="nirmaan-card p-6 border-2 border-nirmaan-black bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display text-sm font-black uppercase tracking-wider text-nirmaan-black">
                  LIVE EVENT SNAPSHOT
                </span>
                <span className="live-dot"></span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-nirmaan-cream p-3 rounded-xl border border-nirmaan-black/10">
                  <p className="text-[10px] font-bold uppercase text-nirmaan-black/60">PRESENT</p>
                  <p className="font-display text-2xl font-black text-nirmaan-black mt-0.5">
                    {stats.present_students}
                  </p>
                </div>
                <div className="bg-nirmaan-cream p-3 rounded-xl border border-nirmaan-black/10">
                  <p className="text-[10px] font-bold uppercase text-nirmaan-black/60">MEALS SERVED</p>
                  <p className="font-display text-2xl font-black text-nirmaan-black mt-0.5">
                    {stats.breakfast_served + stats.lunch_served + stats.dinner_served}
                  </p>
                </div>
                <div className="bg-nirmaan-cream p-3 rounded-xl border border-nirmaan-black/10">
                  <p className="text-[10px] font-bold uppercase text-nirmaan-black/60">COFFEE CUPS</p>
                  <p className="font-display text-2xl font-black text-nirmaan-blue mt-0.5">
                    {stats.total_coffee}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Announcements */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-sm font-black uppercase tracking-wider text-nirmaan-black">
                  LIVE ANNOUNCEMENTS
                </span>
                <span className="text-xs font-bold text-nirmaan-black/50">
                  {announcements.length} updates
                </span>
              </div>
              <AnnouncementList announcements={announcements} />
            </div>
          </div>
        </div>

        {/* Feature Blocks */}
        <div className="border-t border-nirmaan-black/15 pt-12">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-nirmaan-black">
              HOW NIRMAAN-PASS WORKS
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70 mt-1">
              Engineered for seamless live event flow with zero paper queues
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15">
              <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[11px] mb-3 font-black">
                01 • REGISTRATION
              </span>
              <h3 className="font-display text-lg font-black uppercase text-nirmaan-black mb-2">
                ON-DESK CHECK-IN
              </h3>
              <p className="text-xs font-medium text-nirmaan-black/70 leading-relaxed">
                Volunteers scan your team QR at the desk and mark physically present members. This attendance automatically establishes your meal allowance.
              </p>
            </div>

            <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15">
              <span className="nirmaan-pill bg-nirmaan-orange text-white text-[11px] mb-3 font-black">
                02 • FOOD SCANS
              </span>
              <h3 className="font-display text-lg font-black uppercase text-nirmaan-black mb-2">
                MEALS ON YOUR SCHEDULE
              </h3>
              <p className="text-xs font-medium text-nirmaan-black/70 leading-relaxed">
                Team members can eat lunch or dinner together or separately. Every scan records one serving until your present limit is reached.
              </p>
            </div>

            <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15">
              <span className="nirmaan-pill bg-nirmaan-blue text-white text-[11px] mb-3 font-black">
                03 • BEVERAGES
              </span>
              <h3 className="font-display text-lg font-black uppercase text-nirmaan-black mb-2">
                UNLIMITED COFFEE & TEA
              </h3>
              <p className="text-xs font-medium text-nirmaan-black/70 leading-relaxed">
                Keep the hackathon energy going! Unlimited cups are tracked by team with zero caps or artificial restrictions.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-nirmaan-black text-white py-8 border-t border-nirmaan-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-black">nirmaan.</span>
            <span className="text-xs text-white/60 font-medium">© 2026 NIRMAAN Hackathon. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-white/80">
            <Link href="/pass" className="hover:text-nirmaan-amber transition-colors">Pass</Link>
            <Link href="/dashboard" className="hover:text-nirmaan-amber transition-colors">Dashboard</Link>
            <Link href="/event-info" className="hover:text-nirmaan-amber transition-colors">Event Info</Link>
            <Link href="/admin/scanner" className="hover:text-nirmaan-amber transition-colors">Scanner</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

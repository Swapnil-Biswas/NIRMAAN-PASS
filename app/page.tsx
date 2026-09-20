import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAnnouncements } from '@/lib/data/store';
import { getTeamForUser } from '@/lib/auth/session';
import { QrCode, LogIn, LayoutDashboard, ShieldCheck, ArrowRight } from 'lucide-react';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import PassLookupForm from '@/components/Participant/PassLookupForm';
import FirstVisitRedirect from '@/components/FirstVisitRedirect';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [announcements, userTeam] = await Promise.all([
    getAnnouncements(true),
    getTeamForUser(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-nirmaan-cream">
      {!userTeam && <FirstVisitRedirect />}
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-10">
        {/* Main Portal Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 bg-nirmaan-black text-white px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
            NIRMAAN 2026
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-black uppercase text-nirmaan-black tracking-tight">
            PARTICIPANT PASS PORTAL
          </h1>

          <p className="text-xs sm:text-sm font-medium text-nirmaan-black/70 leading-relaxed max-w-lg mx-auto">
            Access your team digital pass for on-desk registration check-in, meal counters, and event updates.
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/pass"
              className="nirmaan-btn nirmaan-btn-primary text-xs px-6 py-3 font-bold shadow-sm"
            >
              <QrCode className="w-4 h-4" />
              VIEW MY PASS
            </Link>

            {userTeam ? (
              <Link
                href="/dashboard"
                className="nirmaan-btn nirmaan-btn-dark text-xs px-6 py-3 font-bold shadow-sm flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4 text-nirmaan-amber" />
                <span>TEAM DASHBOARD</span>
              </Link>
            ) : (
              <Link
                href="/register"
                className="nirmaan-btn nirmaan-btn-dark text-xs px-6 py-3 font-bold shadow-sm flex items-center gap-2"
              >
                <LogIn className="w-4 h-4 text-nirmaan-amber" />
                <span>REGISTER TEAM</span>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Pass Lookup Card / Active Team Card */}
        {userTeam ? (
          <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 max-w-xl mx-auto text-center space-y-3 shadow-xs">
            <div className="inline-flex items-center gap-1.5 bg-nirmaan-green-bright/20 border border-nirmaan-green-dark/30 px-3 py-1 rounded-full text-nirmaan-green-dark text-[11px] font-black uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>LOGGED IN AS {userTeam.team.team_name}</span>
            </div>
            <p className="text-xs font-semibold text-nirmaan-black/70">
              {userTeam.team.college} • {userTeam.members.length} Members Registered
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <Link
                href="/pass"
                className="nirmaan-pill bg-nirmaan-blue text-white text-xs py-2 px-4 font-bold shadow-xs hover:opacity-90 inline-flex items-center gap-1"
              >
                <span>Go to My Pass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/dashboard"
                className="nirmaan-pill bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/15 text-xs py-2 px-4 font-bold hover:bg-nirmaan-cream-card inline-flex items-center gap-1"
              >
                <span>Team Dashboard</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 max-w-xl mx-auto text-center space-y-3 shadow-xs">
            <p className="text-[11px] font-bold uppercase text-nirmaan-black/60 tracking-wider">
              ENTER YOUR TEAM LEADER EMAIL TO ACCESS YOUR PASS:
            </p>
            <PassLookupForm />
            <p className="text-[11px] text-nirmaan-black/50">
              Your access is remembered on this device so you do not need to log in again when you return.
            </p>
          </div>
        )}

        {/* Live Announcements Section */}
        <div className="space-y-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-black uppercase tracking-wider text-nirmaan-black flex items-center gap-1.5">
              <span className="live-dot"></span>
              EVENT ANNOUNCEMENTS
            </span>
            <span className="text-[11px] font-bold text-nirmaan-black/50">
              {announcements.length} updates
            </span>
          </div>
          <AnnouncementList announcements={announcements} />
        </div>

        {/* Official Sponsors Section */}
        <div className="pt-6 border-t border-nirmaan-black/15">
          <SponsorGrid />
        </div>
      </main>

      {/* Participant Footer */}
      <Footer />
    </div>
  );
}

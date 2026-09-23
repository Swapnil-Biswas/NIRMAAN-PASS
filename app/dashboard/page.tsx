import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PassCard from '@/components/TeamQR/PassCard';
import FoodStatusGrid from '@/components/FoodStatus/FoodStatusGrid';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import PassLookupForm from '@/components/Participant/PassLookupForm';
import { findTeamByToken, getAnnouncements, getTeamMembers } from '@/lib/data/store';
import { getTeamForUser } from '@/lib/auth/session';
import { Team, Member } from '@/types/database';
import Link from 'next/link';
import { Users, LayoutDashboard, ExternalLink, LogIn, KeyRound, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

import LiveRefresh from '@/components/Participant/LiveRefresh';
import EditTeamModal from '@/components/Participant/EditTeamModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface DashboardPageProps {
  searchParams?: { token?: string };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const announcementsPromise = getAnnouncements(true);
  let team: Team | null = null;
  let members: Member[] = [];

  if (searchParams?.token) {
    team = await findTeamByToken(searchParams.token);
    members = team ? await getTeamMembers(team.id) : [];
  } else {
    const userTeam = await getTeamForUser();
    if (userTeam) {
      team = userTeam.team;
      members = userTeam.members;
    }
  }

  const announcements = await announcementsPromise;

  if (!team) {
    return (
      <div className="min-h-screen bg-nirmaan-cream flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="nirmaan-card p-4 sm:p-8 text-center max-w-md w-full bg-white border border-nirmaan-black shadow-sm space-y-6">
            <div className="w-12 h-12 rounded-full bg-nirmaan-blue/20 flex items-center justify-center mx-auto text-nirmaan-blue">
              <LayoutDashboard className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-black uppercase text-nirmaan-black mb-1">
                TEAM DASHBOARD
              </h1>
              <p className="text-xs font-medium text-nirmaan-black/70">
                Log in to view your team meal allowances, attendance, and live status.
              </p>
            </div>

            <div className="space-y-3">
              <PassLookupForm />
            </div>

            <div className="pt-4 border-t border-nirmaan-black/10 flex items-center justify-center gap-4 text-xs font-bold">
              <Link href="/login?redirect=/dashboard" className="text-nirmaan-blue hover:underline flex items-center gap-1">
                <LogIn className="w-3.5 h-3.5" />
                Team Login
              </Link>
              <span className="text-nirmaan-black/20">•</span>
              <Link href="/" className="text-nirmaan-black/70 hover:underline flex items-center gap-1">
                Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const presentCount = members.filter((m) => m.present).length;

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="nirmaan-pill bg-nirmaan-blue text-white text-[10px] font-black">
                PARTICIPANT PORTAL
              </span>
              {team.checked_in && (
                <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black">
                  ON-DESK CHECKED IN
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-black uppercase text-nirmaan-black break-words">
              {team.team_name}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70">
              {team.college}
            </p>
            {team.track && (
              <p className="text-xs font-bold text-nirmaan-blue mt-1">{team.track}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <EditTeamModal team={team} members={members} />
            <Link
              href={`/pass?token=${team.qr_token}`}
              className="nirmaan-btn nirmaan-btn-primary text-xs py-2 px-3.5 sm:py-2.5 sm:px-4 font-bold shadow-xs flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              <span>VIEW FULL PASS</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Food & Beverage Entitlement Grid */}
        <div className="mb-10">
          <FoodStatusGrid team={team} members={members} />
        </div>

        {/* 2-Column Layout: Pass Preview & Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Pass Preview Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-black uppercase text-nirmaan-black">
                DIGITAL TEAM PASS
              </span>
              <Link
                href="/pass"
                className="text-xs font-bold text-nirmaan-blue hover:underline flex items-center gap-1"
              >
                Expand Pass <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <PassCard team={team} members={members} />
          </div>

          {/* Right: Team Members & Announcements */}
          <div className="lg:col-span-7 space-y-8">
            {/* Team Roster Card */}
            <div className="nirmaan-card p-4 sm:p-6 bg-white border border-nirmaan-black/15 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-base font-black uppercase text-nirmaan-black flex items-center gap-2">
                    <Users className="w-4 h-4 text-nirmaan-blue" />
                    REGISTERED MEMBERS
                  </h3>
                  <p className="text-xs font-semibold text-nirmaan-black/60">
                    Attendance determines your team's total meal entitlement
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase bg-nirmaan-cream px-3 py-1 rounded-full text-nirmaan-black">
                    {presentCount} / {members.length} Present
                  </span>
                  <EditTeamModal
                    team={team}
                    members={members}
                    buttonLabel="Edit Roster"
                    buttonClassName="nirmaan-pill bg-nirmaan-cream hover:bg-nirmaan-black hover:text-white text-nirmaan-black text-[10px] py-1 px-2.5 border border-nirmaan-black/15 transition-colors shadow-xs inline-flex items-center gap-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-bold text-xs text-nirmaan-black truncate">{member.name}</p>
                      <p className="text-[11px] text-nirmaan-black/60 truncate">{member.phone || 'Phone registered'}</p>
                      {member.email ? (
                        <p className="text-[10px] text-nirmaan-black/40 truncate">{member.email}</p>
                      ) : null}
                    </div>
                    {member.present ? (
                      <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black shrink-0">
                        PRESENT
                      </span>
                    ) : (
                      <span className="nirmaan-pill bg-nirmaan-black/10 text-nirmaan-black/60 text-[10px] font-bold shrink-0">
                        ABSENT
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Announcements Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-sm font-black uppercase tracking-wider text-nirmaan-black">
                  EVENT BROADCASTS & ANNOUNCEMENTS
                </span>
                <span className="live-dot"></span>
              </div>
              <AnnouncementList announcements={announcements} />
            </div>
          </div>
        </div>

        {/* Official Sponsors Section */}
        <div className="mt-12 pt-10 border-t border-nirmaan-black/15">
          <SponsorGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
}

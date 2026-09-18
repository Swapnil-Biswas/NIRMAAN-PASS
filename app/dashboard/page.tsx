import React from 'react';
import Navbar from '@/components/Navbar';
import PassCard from '@/components/TeamQR/PassCard';
import FoodStatusGrid from '@/components/FoodStatus/FoodStatusGrid';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import { findTeamByToken, getTeamMembers, getAnnouncements, getAllTeams } from '@/lib/data/store';
import Link from 'next/link';
import { Users, LayoutDashboard, ShieldCheck, QrCode, ArrowRight, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams?: { token?: string };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const token = searchParams?.token || 'nirmaan_alpha_9281a';
  const team = (await findTeamByToken(token)) || (await findTeamByToken('nirmaan_alpha_9281a'));
  const members = team ? await getTeamMembers(team.id) : [];
  const announcements = await getAnnouncements(true);
  const allTeams = await getAllTeams();

  if (!team) {
    return (
      <div className="min-h-screen bg-nirmaan-cream flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="nirmaan-card p-8 text-center max-w-md bg-white border border-nirmaan-black">
            <h1 className="font-display text-2xl font-black uppercase text-nirmaan-red mb-2">
              TEAM NOT FOUND
            </h1>
            <p className="text-xs font-semibold text-nirmaan-black/70 mb-4">
              Unable to load dashboard for this team token.
            </p>
            <Link href="/" className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-4 font-bold">
              Return Home
            </Link>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
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
            <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-nirmaan-black">
              {team.team_name}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70">
              {team.college}
            </p>
          </div>

          {/* Quick Switch Team Context */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-nirmaan-black/15 shadow-sm text-xs font-semibold">
            <span className="text-nirmaan-black/50 uppercase font-bold text-[10px]">TEAM:</span>
            <div className="flex gap-1">
              {allTeams.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard?token=${t.qr_token}`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase transition-colors ${
                    t.qr_token === team.qr_token
                      ? 'bg-nirmaan-black text-white'
                      : 'hover:bg-nirmaan-cream text-nirmaan-black'
                  }`}
                >
                  {t.team_name.split(' ')[1] || t.team_name}
                </Link>
              ))}
            </div>
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
                href={`/pass?token=${team.qr_token}`}
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
            <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-black uppercase text-nirmaan-black flex items-center gap-2">
                    <Users className="w-4 h-4 text-nirmaan-blue" />
                    REGISTERED MEMBERS
                  </h3>
                  <p className="text-xs font-semibold text-nirmaan-black/60">
                    Attendance determines your team's total meal entitlement
                  </p>
                </div>
                <span className="text-xs font-bold uppercase bg-nirmaan-cream px-3 py-1 rounded-full text-nirmaan-black">
                  {presentCount} / {members.length} Present
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-xs text-nirmaan-black">{member.name}</p>
                      <p className="text-[11px] text-nirmaan-black/60">{member.phone}</p>
                      <p className="text-[10px] text-nirmaan-black/40">{member.email}</p>
                    </div>
                    {member.present ? (
                      <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black">
                        PRESENT
                      </span>
                    ) : (
                      <span className="nirmaan-pill bg-nirmaan-black/10 text-nirmaan-black/60 text-[10px] font-bold">
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
    </div>
  );
}

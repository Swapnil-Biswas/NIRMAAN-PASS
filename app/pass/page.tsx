import React from 'react';
import Navbar from '@/components/Navbar';
import PassCard from '@/components/TeamQR/PassCard';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import { findTeamByToken, getTeamMembers, getAllTeams } from '@/lib/data/store';
import Link from 'next/link';
import { ArrowLeft, Users, ShieldCheck, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PassPageProps {
  searchParams?: { token?: string };
}

export default async function PassPage({ searchParams }: PassPageProps) {
  const token = searchParams?.token || 'nirmaan_alpha_9281a';
  const team = (await findTeamByToken(token)) || (await findTeamByToken('nirmaan_alpha_9281a'));
  const members = team ? await getTeamMembers(team.id) : [];
  const allTeams = await getAllTeams();

  if (!team) {
    return (
      <div className="min-h-screen bg-nirmaan-cream flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="nirmaan-card p-8 text-center max-w-md bg-white border border-nirmaan-black">
            <h1 className="font-display text-2xl font-black uppercase text-nirmaan-red mb-2">
              PASS NOT FOUND
            </h1>
            <p className="text-xs font-semibold text-nirmaan-black/70 mb-4">
              Unable to locate team pass with the provided token.
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

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-black/70 hover:text-nirmaan-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO DASHBOARD
          </Link>

          {/* Quick Team Switcher for Testing / Multi-team View */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-nirmaan-black/15 shadow-sm text-xs font-semibold">
            <span className="text-nirmaan-black/50 uppercase font-bold text-[10px]">PASS:</span>
            <div className="flex gap-1">
              {allTeams.map((t) => (
                <Link
                  key={t.id}
                  href={`/pass?token=${t.qr_token}`}
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

        {/* Digital Pass Card */}
        <div className="mb-8">
          <PassCard team={team} members={members} />
        </div>

        {/* Team Members Attendance Card */}
        <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-black uppercase text-nirmaan-black flex items-center gap-2">
              <Users className="w-4 h-4 text-nirmaan-blue" />
              TEAM ROSTER & ATTENDANCE
            </h3>
            <span className="text-xs font-bold uppercase text-nirmaan-black/70 bg-nirmaan-cream px-2.5 py-1 rounded-full">
              {presentCount} / {members.length} PRESENT
            </span>
          </div>

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-xs text-nirmaan-black">{member.name}</p>
                  <p className="text-[11px] text-nirmaan-black/60">{member.email}</p>
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

        {/* Official Sponsors Section */}
        <div className="mt-12 pt-10 border-t border-nirmaan-black/15">
          <SponsorGrid />
        </div>
      </main>
    </div>
  );
}

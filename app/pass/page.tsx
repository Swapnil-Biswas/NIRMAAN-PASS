import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PassCard from '@/components/TeamQR/PassCard';
import SponsorGrid from '@/components/Sponsors/SponsorGrid';
import { findTeamByToken, getTeamMembers } from '@/lib/data/store';
import { getTeamForUser } from '@/lib/auth/session';
import { Team, Member } from '@/types/database';
import PassLookupForm from '@/components/Participant/PassLookupForm';
import Link from 'next/link';
import { ArrowLeft, Users, QrCode, LogIn, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PassPageProps {
  searchParams?: { token?: string };
}

export default async function PassPage({ searchParams }: PassPageProps) {
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

  // If no team loaded (unauthenticated and no token provided, or invalid token)
  if (!team) {
    return (
      <div className="min-h-screen bg-nirmaan-cream flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="nirmaan-card p-8 text-center max-w-md w-full bg-white border border-nirmaan-black shadow-sm space-y-6">
            <div className="w-12 h-12 rounded-full bg-nirmaan-amber/20 flex items-center justify-center mx-auto text-nirmaan-black">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-black uppercase text-nirmaan-black mb-1">
                ACCESS YOUR TEAM PASS
              </h1>
              <p className="text-xs font-medium text-nirmaan-black/70">
                Log in with your team credentials or enter your team pass token to view your digital pass.
              </p>
            </div>

            <div className="space-y-3">
              <PassLookupForm />
            </div>

            <div className="pt-4 border-t border-nirmaan-black/10 flex items-center justify-center gap-4 text-xs font-bold">
              <Link href="/login?redirect=/pass" className="text-nirmaan-blue hover:underline flex items-center gap-1">
                <LogIn className="w-3.5 h-3.5" />
                Team Login
              </Link>
              <span className="text-nirmaan-black/20">•</span>
              <Link href="/activate" className="text-nirmaan-black/70 hover:underline flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                Activate Account
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

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Top Header Controls */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href={`/dashboard${searchParams?.token ? `?token=${encodeURIComponent(searchParams.token)}` : ''}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-black/70 hover:text-nirmaan-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO DASHBOARD
          </Link>

          <span className="nirmaan-pill bg-white text-nirmaan-black border border-nirmaan-black/15 text-[11px] font-bold">
            {team.team_name}
          </span>
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

      <Footer />
    </div>
  );
}

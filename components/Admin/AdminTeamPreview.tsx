'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  QrCode,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Users,
  Eye,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Team, Member, Announcement } from '@/types/database';
import PassCard from '@/components/TeamQR/PassCard';
import FoodStatusGrid from '@/components/FoodStatus/FoodStatusGrid';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';

interface TeamWithMembers extends Team {
  members: Member[];
  present_count: number;
  total_members: number;
}

interface AdminTeamPreviewProps {
  currentTeam: TeamWithMembers | null;
  allTeams: { id: string; team_name: string; college: string; checked_in: boolean }[];
  announcements: Announcement[];
}

export default function AdminTeamPreview({
  currentTeam,
  allTeams,
  announcements,
}: AdminTeamPreviewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pass' | 'dashboard'>('pass');

  const handleSelectTeam = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    if (teamId) {
      router.push(`/admin/dashboard/pass?teamId=${teamId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Back Button & Team Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-black/70 hover:text-nirmaan-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO DASHBOARD & TEAMS
        </Link>

        {/* Quick Team Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-[11px] font-bold uppercase text-nirmaan-black/60 hidden sm:inline whitespace-nowrap">
            Switch Team:
          </label>
          <div className="relative w-full sm:w-72">
            <select
              value={currentTeam?.id || ''}
              onChange={handleSelectTeam}
              className="w-full appearance-none bg-white border-2 border-nirmaan-black/20 rounded-xl px-3.5 py-2 pr-9 font-bold text-xs text-nirmaan-black focus:border-nirmaan-black focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                -- Select a team --
              </option>
              {allTeams
                .slice()
                .sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' }))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name} ({t.college})
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nirmaan-black/50 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Read-Only Notice Banner */}
      <div className="bg-nirmaan-blue/10 border-2 border-nirmaan-blue/30 p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-nirmaan-blue">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>
            ORGANIZER READ-ONLY VIEW — Viewing live participant interface. Modifying state is disabled here.
          </span>
        </div>
        <Link
          href="/admin/scanner"
          className="nirmaan-pill bg-nirmaan-red text-white text-[10px] font-black py-1.5 px-3 hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          OPEN SCANNER DESK ➔
        </Link>
      </div>



      {!currentTeam ? (
        <div className="nirmaan-card p-12 text-center bg-white border border-nirmaan-black/15 shadow-sm space-y-4 max-w-md mx-auto">
          <Info className="w-8 h-8 mx-auto text-nirmaan-black/40" />
          <h3 className="font-display text-lg font-black uppercase text-nirmaan-black">
            NO TEAM SELECTED
          </h3>
          <p className="text-xs text-nirmaan-black/60">
            Please choose a team from the dropdown above or navigate from the teams table.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* View Tab Selector: Digital Pass vs Team Dashboard */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-2 border-b border-nirmaan-black/10 pb-4">
            <button
              onClick={() => setActiveTab('pass')}
              className={`nirmaan-pill text-xs font-bold transition-all py-2.5 px-4 sm:px-5 flex items-center justify-center gap-2 ${
                activeTab === 'pass'
                  ? 'bg-nirmaan-blue text-white shadow-md'
                  : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="sm:hidden">DIGITAL PASS</span>
              <span className="hidden sm:inline">DIGITAL PASS VIEW (/pass)</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nirmaan-pill text-xs font-bold transition-all py-2.5 px-4 sm:px-5 flex items-center justify-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-nirmaan-amber text-nirmaan-black shadow-md'
                  : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="sm:hidden">DASHBOARD</span>
              <span className="hidden sm:inline">DASHBOARD VIEW (/dashboard)</span>
            </button>
          </div>

          {/* TAB 1: Digital Pass View */}
          {activeTab === 'pass' && (
            <div className="max-w-xl mx-auto space-y-6">
              {/* Pass Card Preview */}
              <PassCard team={currentTeam} members={currentTeam.members} />

              {/* Team Members Attendance Card */}
              <div className="nirmaan-card p-4 sm:p-6 bg-white border border-nirmaan-black/15">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-display text-xs sm:text-sm font-black uppercase text-nirmaan-black flex items-center gap-1.5 sm:gap-2">
                    <Users className="w-4 h-4 text-nirmaan-blue" />
                    TEAM ROSTER &amp; ATTENDANCE
                  </h3>
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-nirmaan-black/70 bg-nirmaan-cream px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full whitespace-nowrap">
                    {currentTeam.present_count} / {currentTeam.members.length} PRESENT
                  </span>
                </div>

                <div className="space-y-2">
                  {currentTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 rounded-xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-bold text-xs text-nirmaan-black truncate">{member.name}</p>
                        <p className="text-[11px] text-nirmaan-black/60 truncate">
                          {member.phone || (member.email ? member.email : 'Registered Member')}
                        </p>
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
            </div>
          )}

          {/* TAB 2: Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Team Info Header */}
              <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="nirmaan-pill bg-nirmaan-blue text-white text-[10px] font-black">
                      TEAM VIEW
                    </span>
                    {currentTeam.checked_in ? (
                      <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black">
                        ON-DESK CHECKED IN
                      </span>
                    ) : (
                      <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black">
                        UNREGISTERED
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-nirmaan-black">
                    {currentTeam.team_name}
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70">
                    {currentTeam.college}
                  </p>
                  {currentTeam.track && (
                    <p className="text-xs font-bold text-nirmaan-blue mt-1">
                      {currentTeam.track}
                    </p>
                  )}
                </div>

                <div className="text-right sm:text-right">
                  <span className="text-xs font-bold uppercase text-nirmaan-black/60 block">
                    Attendance
                  </span>
                  <span className="font-display text-2xl font-black text-nirmaan-black">
                    {currentTeam.present_count} / {currentTeam.members.length}
                  </span>
                </div>
              </div>

              {/* Food & Beverage Entitlement Grid */}
              <FoodStatusGrid team={currentTeam} members={currentTeam.members} />

              {/* 2-Column: Members & Announcements */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Team Members List */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="nirmaan-card p-6 bg-white border border-nirmaan-black/15 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display text-base font-black uppercase text-nirmaan-black flex items-center gap-2">
                          <Users className="w-4 h-4 text-nirmaan-blue" />
                          REGISTERED MEMBERS
                        </h3>
                      </div>
                      <span className="text-xs font-bold uppercase bg-nirmaan-cream px-3 py-1 rounded-full text-nirmaan-black">
                        {currentTeam.present_count} / {currentTeam.members.length} Present
                      </span>
                    </div>

                    <div className="space-y-2">
                      {currentTeam.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 rounded-xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-xs text-nirmaan-black">{member.name}</p>
                            <p className="text-[11px] text-nirmaan-black/60">
                              {member.phone || 'Phone registered'}
                            </p>
                            {member.email ? (
                              <p className="text-[10px] text-nirmaan-black/40">{member.email}</p>
                            ) : null}
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
                </div>

                {/* Live Announcements Preview */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-black uppercase tracking-wider text-nirmaan-black">
                      EVENT BROADCASTS PREVIEW
                    </span>
                    <span className="live-dot"></span>
                  </div>
                  <AnnouncementList announcements={announcements} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

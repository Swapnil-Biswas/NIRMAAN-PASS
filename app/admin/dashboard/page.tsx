import React from 'react';
import StatsOverview from '@/components/Admin/StatsOverview';
import TeamsTable from '@/components/Admin/TeamsTable';
import { getEventStatistics, getAllTeams } from '@/lib/data/store';
import Link from 'next/link';
import { QrCode, Megaphone, Calendar } from 'lucide-react';
import LiveRefresh from '@/components/Participant/LiveRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminDashboardPage() {
  const stats = await getEventStatistics();
  const teams = await getAllTeams();

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="nirmaan-pill bg-nirmaan-green-dark text-white text-[10px] font-black">
              ADMIN CONSOLE
            </span>
            <span className="text-xs font-bold uppercase text-nirmaan-black/60">
              NIRMAAN 2026 EVENT OPERATIONS
            </span>
            <LiveRefresh intervalMs={4000} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-nirmaan-black">
            EVENT OVERVIEW & STATS
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/scanner"
            className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-4 font-black shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            OPEN SCANNER
          </Link>
          <Link
            href="/admin/announcements"
            className="nirmaan-btn nirmaan-btn-dark text-xs py-2.5 px-4 font-black shadow-sm"
          >
            <Megaphone className="w-4 h-4 text-nirmaan-amber" />
            BROADCAST
          </Link>
          <Link
            href="/admin/schedule"
            className="nirmaan-btn bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/20 text-xs py-2.5 px-4 font-black shadow-sm"
          >
            <Calendar className="w-4 h-4 text-nirmaan-blue" />
            SCHEDULE
          </Link>
        </div>
      </div>

      {/* 8 Metric Statistics Overview */}
      <StatsOverview stats={stats} />

      {/* Teams Table Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold uppercase text-nirmaan-black">
            PARTICIPATING TEAMS & CONSUMPTION LOG
          </h2>
        </div>

        <TeamsTable teams={teams} />
      </div>
    </main>
  );
}

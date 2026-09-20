'use client';

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Eye, Utensils, Coffee, Sun, Moon, Download } from 'lucide-react';
import { Team, Member } from '@/types/database';
import Link from 'next/link';

interface TeamRowData extends Team {
  members: Member[];
  present_count: number;
  total_members: number;
}

interface TeamsTableProps {
  teams: TeamRowData[];
  onSelectTeam?: (team: TeamRowData) => void;
}

export default function TeamsTable({ teams, onSelectTeam }: TeamsTableProps) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const filteredTeams = teams.filter(
    (t) =>
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.college.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredTeams.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTeams =
    pageSize === 0
      ? filteredTeams
      : filteredTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const exportToExcel = () => {
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = [
      'Team Name',
      'College',
      'Track',
      'Status',
      'Total Members',
      'Present Count',
      'Member Names',
      'Member Emails',
      'Member Phones',
      'Breakfast Served',
      'Lunch Served',
      'Dinner Served',
      'Coffee / Tea Served',
    ];

    const rows = filteredTeams.map((team) => [
      escapeCSV(team.team_name),
      escapeCSV(team.college),
      escapeCSV(team.track || 'N/A'),
      team.checked_in ? 'Checked In' : 'Unregistered',
      String(team.total_members),
      String(team.present_count),
      escapeCSV(team.members.map((m) => m.name).join('; ')),
      escapeCSV(team.members.map((m) => m.email).join('; ')),
      escapeCSV(team.members.map((m) => m.phone).join('; ')),
      String(team.breakfast_count),
      String(team.lunch_count),
      String(team.dinner_count),
      String(team.coffee_count),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NIRMAAN_2026_Teams_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4">
      {/* Search & Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full max-w-md">
          <input
            type="text"
            placeholder="Search team by name or college..."
            value={search}
            onChange={handleSearchChange}
            className="flex-1 px-4 py-2 rounded-full border border-nirmaan-black/20 bg-white font-medium text-xs outline-none focus:border-nirmaan-black"
          />
          <button
            type="button"
            onClick={exportToExcel}
            className="nirmaan-pill bg-nirmaan-green-dark text-white text-[10px] font-black py-2 px-3 hover:opacity-90 transition-opacity shadow-xs flex-shrink-0"
            title="Export to Excel (CSV)"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-nirmaan-black/70">
          <span className="hidden md:inline">
            {filteredTeams.length} of {teams.length} teams
          </span>

          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-nirmaan-black/15 shadow-xs">
            <span className="text-[10px] uppercase text-nirmaan-black/50">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent font-bold text-xs outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-full bg-white border border-nirmaan-black/15 disabled:opacity-30 hover:bg-nirmaan-cream"
              >
                ◀
              </button>
              <span className="px-1 text-[11px]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-full bg-white border border-nirmaan-black/15 disabled:opacity-30 hover:bg-nirmaan-cream"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Box */}
      <div className="nirmaan-card overflow-hidden border border-nirmaan-black/15 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-nirmaan-cream border-b border-nirmaan-black/10 text-nirmaan-black uppercase font-display font-bold">
              <tr>
                <th className="p-3.5">Team & College</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Attendance</th>
                <th className="p-3.5 text-center">Breakfast</th>
                <th className="p-3.5 text-center">Lunch</th>
                <th className="p-3.5 text-center">Dinner</th>
                <th className="p-3.5 text-center">Coffee / Tea</th>
                <th className="p-3.5 text-right">Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nirmaan-black/5 font-medium">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-nirmaan-black/50 font-bold space-y-1">
                    <p className="text-sm text-nirmaan-black/70 font-black uppercase">
                      {search ? `No teams found matching "${search}"` : 'No teams registered yet'}
                    </p>
                    <p className="text-xs font-medium text-nirmaan-black/50">
                      {search ? 'Try clearing your search query.' : 'Teams will appear here in real time as participants complete registration.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-nirmaan-cream/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-sm text-nirmaan-black">
                        {team.team_name}
                      </div>
                      <div className="text-[11px] text-nirmaan-black/60">
                        {team.college}
                      </div>
                    </td>

                    <td className="p-3.5">
                      {team.checked_in ? (
                        <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black">
                          <ShieldCheck className="w-3 h-3" />
                          CHECKED IN
                        </span>
                      ) : (
                        <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black">
                          <AlertTriangle className="w-3 h-3" />
                          UNREGISTERED
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center font-bold">
                      <span className="bg-nirmaan-cream px-2.5 py-1 rounded-full text-nirmaan-black">
                        {team.present_count} / {team.total_members}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-bold">
                        {team.breakfast_count}
                      </span>
                      <span className="text-nirmaan-black/40 text-[10px]">
                        /{team.checked_in ? team.present_count : team.total_members}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-bold">
                        {team.lunch_count}
                      </span>
                      <span className="text-nirmaan-black/40 text-[10px]">
                        /{team.checked_in ? team.present_count : team.total_members}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-bold">
                        {team.dinner_count}
                      </span>
                      <span className="text-nirmaan-black/40 text-[10px]">
                        /{team.checked_in ? team.present_count : team.total_members}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-bold text-nirmaan-blue">
                      {team.coffee_count} cups
                    </td>

                    <td className="p-3.5 text-right">
                      <Link
                        href={`/admin/dashboard/pass?teamId=${team.id}`}
                        className="nirmaan-pill bg-nirmaan-cream hover:bg-nirmaan-black hover:text-white text-nirmaan-black text-[10px] py-1 px-2.5 border border-nirmaan-black/15 transition-colors shadow-xs inline-flex items-center gap-1"
                        title="View Team Pass & Dashboard"
                      >
                        <span>Pass</span>
                        <span>➔</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

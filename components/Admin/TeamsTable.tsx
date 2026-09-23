'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Eye,
  Utensils,
  Coffee,
  Sun,
  Moon,
  Download,
  CheckCircle2,
  Users,
  UserCheck,
  Trash2,
  Phone,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { Team, Member } from '@/types/database';
import Link from 'next/link';
import RegistrationModal from '@/components/Admin/RegistrationModal';

interface TeamRowData extends Team {
  members: Member[];
  present_count: number;
  total_members: number;
}

interface TeamsTableProps {
  teams: TeamRowData[];
  onSelectTeam?: (team: TeamRowData) => void;
}

export default function TeamsTable({ teams: initialTeams, onSelectTeam }: TeamsTableProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRowData[]>(initialTeams);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [registrationModalTeam, setRegistrationModalTeam] = useState<TeamRowData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Keep local state in sync if prop updates
  React.useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const checkedInCount = teams.filter((t) => t.checked_in).length;
  const notCheckedInCount = teams.filter((t) => !t.checked_in).length;

  const filteredTeams = teams.filter((t) => {
    const leader = t.members.find((m) => m.is_leader) || t.members[0];
    const matchesSearch =
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.college.toLowerCase().includes(search.toLowerCase()) ||
      (leader?.name && leader.name.toLowerCase().includes(search.toLowerCase())) ||
      (leader?.email && leader.email.toLowerCase().includes(search.toLowerCase())) ||
      (leader?.phone && leader.phone.includes(search));

    if (!matchesSearch) return false;

    if (statusFilter === 'checked_in') {
      return t.checked_in;
    }
    if (statusFilter === 'not_checked_in') {
      return !t.checked_in;
    }
    return true;
  }).sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' }));

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

  const handleCheckInConfirm = async (presentMemberIds: string[]) => {
    if (!registrationModalTeam) return;
    setCheckInLoading(true);
    try {
      const res = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: registrationModalTeam.qr_token,
          purpose: 'registration',
          action: 'registration',
          present_member_ids: presentMemberIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'On-desk check-in failed');
      }

      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === registrationModalTeam.id) {
            const updatedMembers = t.members.map((m) => ({
              ...m,
              present: presentMemberIds.includes(m.id),
            }));
            return {
              ...t,
              checked_in: true,
              members: updatedMembers,
              present_count: presentMemberIds.length,
            };
          }
          return t;
        })
      );

      setRegistrationModalTeam(null);
    } catch (err: any) {
      alert(err.message || 'Error completing on-desk check-in');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete team "${teamName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleteLoading(teamId);
    try {
      const res = await fetch(`/api/admin/teams?id=${encodeURIComponent(teamId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete team');
      }

      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete team');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleClearAllTeams = async () => {
    if (!window.confirm('⚠️ DANGER: Are you sure you want to delete ALL teams and consumption logs? This will reset all event statistics and cannot be undone.')) {
      return;
    }

    setDeleteLoading('all');
    try {
      const res = await fetch('/api/admin/teams?all=true', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to clear all teams');
      }

      setTeams([]);
    } catch (err: any) {
      alert(err.message || 'Failed to clear all teams');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleResetAllScans = async () => {
    if (
      !window.confirm(
        '⚠️ Are you sure you want to reset all scans and attendance back to 0? All meal counters and check-in statuses will be reset.'
      )
    ) {
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/admin/reset-scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset scans');
      }

      setTeams((prev) =>
        prev.map((t) => ({
          ...t,
          checked_in: false,
          breakfast_count: 0,
          lunch_count: 0,
          dinner_count: 0,
          coffee_count: 0,
          present_count: 0,
          members: t.members.map((m) => ({ ...m, present: false })),
        }))
      );
      alert('All scans and attendance have been reset.');
    } catch (err: any) {
      alert(err.message || 'Failed to reset scans');
    } finally {
      setResetLoading(false);
    }
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
      'Leader Name',
      'Leader Email',
      'Leader Phone',
      'Status',
      'Total Members',
      'Present Count',
      'Member Names & Phones',
      'Breakfast Served',
      'Lunch Served',
      'Dinner Served',
      'Coffee / Tea Served',
      'Notes',
    ];

    const rows = filteredTeams.map((team) => {
      const leader = team.members.find((m) => m.is_leader) || team.members[0];
      return [
        escapeCSV(team.team_name),
        escapeCSV(team.college),
        escapeCSV(team.track || 'Open Innovation'),
        escapeCSV(leader?.name || ''),
        escapeCSV(leader?.email || ''),
        escapeCSV(leader?.phone || ''),
        team.checked_in ? 'Checked In' : 'Not Checked In',
        String(team.total_members),
        String(team.present_count),
        escapeCSV(team.members.map((m) => `${m.name} (${m.phone})`).join('; ')),
        String(team.breakfast_count),
        String(team.lunch_count),
        String(team.dinner_count),
        String(team.coffee_count),
        escapeCSV(team.duplicate_notes || ''),
      ];
    });

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
      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`nirmaan-pill text-xs py-1.5 px-3 font-bold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-nirmaan-black text-white'
                : 'bg-white text-nirmaan-black border border-nirmaan-black/15 hover:bg-nirmaan-cream'
            }`}
          >
            All Teams ({teams.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('checked_in');
              setPage(1);
            }}
            className={`nirmaan-pill text-xs py-1.5 px-3 font-bold transition-colors cursor-pointer ${
              statusFilter === 'checked_in'
                ? 'bg-nirmaan-green-dark text-white'
                : 'bg-white text-nirmaan-black border border-nirmaan-black/15 hover:bg-nirmaan-cream'
            }`}
          >
            Checked In ({checkedInCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('not_checked_in');
              setPage(1);
            }}
            className={`nirmaan-pill text-xs py-1.5 px-3 font-bold transition-colors cursor-pointer ${
              statusFilter === 'not_checked_in'
                ? 'bg-nirmaan-amber text-nirmaan-black'
                : 'bg-white text-nirmaan-black border border-nirmaan-black/15 hover:bg-nirmaan-cream'
            }`}
          >
            Not Checked In ({notCheckedInCount})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by team, college, leader, email..."
            value={search}
            onChange={handleSearchChange}
            className="flex-1 sm:w-72 px-4 py-2 rounded-full border border-nirmaan-black/20 bg-white font-medium text-xs outline-none focus:border-nirmaan-black"
          />
          <button
            type="button"
            onClick={exportToExcel}
            className="nirmaan-pill bg-nirmaan-green-dark text-white text-[10px] font-black py-2 px-3 hover:opacity-90 transition-opacity shadow-xs flex-shrink-0"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
          {teams.length > 0 && (
            <button
              type="button"
              disabled={resetLoading}
              onClick={handleResetAllScans}
              className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black py-2 px-3 hover:opacity-90 transition-opacity shadow-xs flex-shrink-0 disabled:opacity-50"
              title="Reset all attendance and meal scans back to 0"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
              <span>{resetLoading ? 'RESETTING...' : 'RESET SCANS'}</span>
            </button>
          )}
          {teams.length > 0 && (
            <button
              type="button"
              disabled={deleteLoading !== null}
              onClick={handleClearAllTeams}
              className="nirmaan-pill bg-nirmaan-red text-white text-[10px] font-black py-2 px-3 hover:opacity-90 transition-opacity shadow-xs flex-shrink-0 disabled:opacity-50"
              title="Delete all teams and reset event statistics"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleteLoading === 'all' ? 'CLEARING...' : 'CLEAR'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Pagination & Count Header */}
      <div className="flex items-center justify-between text-xs font-bold text-nirmaan-black/70 px-1">
        <span>
          Showing {filteredTeams.length} of {teams.length} teams
        </span>

        <div className="flex items-center gap-3">
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
                <th className="p-3.5">Team &amp; College</th>
                <th className="p-3.5">Leader &amp; Contact</th>
                <th className="p-3.5 text-center">Roster</th>
                <th className="p-3.5 text-center">Desk Check-In</th>
                <th className="p-3.5 text-center">Breakfast</th>
                <th className="p-3.5 text-center">Lunch</th>
                <th className="p-3.5 text-center">Dinner</th>
                <th className="p-3.5 text-center">Coffee</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nirmaan-black/5 font-medium">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-nirmaan-black/50 font-bold space-y-1">
                    <p className="text-sm text-nirmaan-black/70 font-black uppercase">
                      {search ? `No teams found matching "${search}"` : 'No teams found'}
                    </p>
                    <p className="text-xs font-medium text-nirmaan-black/50">
                      Try clearing your search query or adjusting filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTeams.map((team) => {
                  const leader = team.members.find((m) => m.is_leader) || team.members[0];
                  return (
                    <tr key={team.id} className="hover:bg-nirmaan-cream/40 transition-colors">
                      {/* Team & College */}
                      <td className="p-3.5">
                        <div className="font-bold text-sm text-nirmaan-black">
                          {team.team_name}
                        </div>
                        <div className="text-[11px] text-nirmaan-black/60 leading-snug">
                          {team.college}
                        </div>
                      </td>

                      {/* Leader & Contact */}
                      <td className="p-3.5">
                        <div className="font-bold text-xs text-nirmaan-black">
                          {leader?.name || 'N/A'}
                        </div>
                        {leader?.email && (
                          <div className="text-[11px] text-nirmaan-black/70 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-nirmaan-black/40 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{leader.email}</span>
                          </div>
                        )}
                        {leader?.phone && (
                          <div className="text-[11px] text-nirmaan-black/60 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-nirmaan-black/40 flex-shrink-0" />
                            <span>{leader.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Roster count */}
                      <td className="p-3.5 text-center">
                        <span className="nirmaan-pill bg-nirmaan-black/5 text-nirmaan-black text-[10px] font-bold">
                          {team.total_members} Members
                        </span>
                      </td>

                      {/* Desk Check-In */}
                      <td className="p-3.5 text-center">
                        {team.checked_in ? (
                          <span className="inline-flex items-center gap-1 bg-nirmaan-green-bright/20 text-nirmaan-green-dark border border-nirmaan-green-dark/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{team.present_count}/{team.total_members} Present</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-nirmaan-black/5 text-nirmaan-black/50 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                            <span>Not Checked In</span>
                          </span>
                        )}
                      </td>

                      {/* Breakfast */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold">{team.breakfast_count}</span>
                        <span className="text-nirmaan-black/40 text-[10px]">
                          /{team.checked_in ? team.present_count : team.total_members}
                        </span>
                      </td>

                      {/* Lunch */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold">{team.lunch_count}</span>
                        <span className="text-nirmaan-black/40 text-[10px]">
                          /{team.checked_in ? team.present_count : team.total_members}
                        </span>
                      </td>

                      {/* Dinner */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold">{team.dinner_count}</span>
                        <span className="text-nirmaan-black/40 text-[10px]">
                          /{team.checked_in ? team.present_count : team.total_members}
                        </span>
                      </td>

                      {/* Coffee */}
                      <td className="p-3.5 text-center font-bold text-nirmaan-blue">
                        {team.coffee_count}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setRegistrationModalTeam(team)}
                          className="nirmaan-pill bg-nirmaan-amber hover:opacity-90 text-nirmaan-black text-[10px] py-1 px-2.5 font-black shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          title="Mark on-desk physical attendance"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{team.checked_in ? 'Edit Attendance' : 'Desk Check-In'}</span>
                        </button>

                        <Link
                          href={`/admin/dashboard/pass?teamId=${team.id}`}
                          className="nirmaan-pill bg-nirmaan-cream hover:bg-nirmaan-black hover:text-white text-nirmaan-black text-[10px] py-1 px-2.5 border border-nirmaan-black/15 transition-colors shadow-xs inline-flex items-center gap-1"
                          title="View Team Pass & QR"
                        >
                          <span>Pass</span>
                          <span>➔</span>
                        </Link>

                        <button
                          type="button"
                          disabled={deleteLoading === team.id}
                          onClick={() => handleDeleteTeam(team.id, team.team_name)}
                          className="nirmaan-pill bg-nirmaan-red/10 hover:bg-nirmaan-red hover:text-white text-nirmaan-red text-[10px] py-1 px-2 font-bold border border-nirmaan-red/30 transition-colors shadow-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={`Delete ${team.team_name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* On-Desk Registration & Check-In Attendance Modal */}
      {registrationModalTeam && (
        <RegistrationModal
          team={registrationModalTeam}
          members={registrationModalTeam.members}
          onConfirm={handleCheckInConfirm}
          onCancel={() => setRegistrationModalTeam(null)}
          loading={checkInLoading}
        />
      )}
    </div>
  );
}

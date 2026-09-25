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
} from 'lucide-react';
import { Team, Member, ScanEvent, ScanEventRecord } from '@/types/database';
import Link from 'next/link';
import RegistrationModal from '@/components/Admin/RegistrationModal';

interface TeamRowData extends Team {
  members: Member[];
  present_count: number;
  total_members: number;
}

interface TeamsTableProps {
  teams: TeamRowData[];
  customEvents?: ScanEvent[];
  customRecords?: ScanEventRecord[];
  onSelectTeam?: (team: TeamRowData) => void;
}

export default function TeamsTable({
  teams: initialTeams,
  customEvents = [],
  customRecords = [],
  onSelectTeam,
}: TeamsTableProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRowData[]>(initialTeams);
  const activeCustomEvents = customEvents.filter((e) => e.active);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [registrationModalTeam, setRegistrationModalTeam] = useState<TeamRowData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Keep local state in sync if prop updates
  React.useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const checkedInCount = teams.filter((t) => t.checked_in).length;
  const notCheckedInCount = teams.filter((t) => !t.checked_in).length;

  const filteredTeams = teams.filter((t) => {
    const q = search.trim().toLowerCase();
    
    if (q) {
      const matchesTeamName = t.team_name.toLowerCase().includes(q);
      const matchesCollege = (t.college || '').toLowerCase().includes(q);
      const matchesMember = t.members.some(
        (m) =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.phone && m.phone.includes(q))
      );

      if (!matchesTeamName && !matchesCollege && !matchesMember) {
        return false;
      }
    }

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
      'Check-In Status',
      'Total Members',
      'Present Count',
      'Absent Count',
      'Present Members',
      'Absent Members',
      'All Members (Name & Phone)',
      'Breakfast Served',
      'Lunch Served',
      'Dinner Served',
      'Coffee / Tea Served',
      ...activeCustomEvents.map((e) => `Event: ${e.title}`),
      'Notes',
    ];

    const rows = filteredTeams.map((team) => {
      const leader = team.members.find((m) => m.is_leader) || team.members[0];
      const presentMembers = team.members.filter((m) => m.present);
      const absentMembers = team.checked_in
        ? team.members.filter((m) => !m.present)
        : team.members;
      const absentCount = team.checked_in
        ? team.total_members - team.present_count
        : team.total_members;

      const customEventValues = activeCustomEvents.map((evt) => {
        const records = customRecords.filter((r) => r.event_id === evt.id && r.team_id === team.id);
        const count = records.reduce((acc, r) => acc + r.count, 0);
        if (evt.limit_rule === 'once_per_team') {
          return count > 0 ? 'Completed (1/1)' : 'Pending (0/1)';
        }
        if (evt.limit_rule === 'per_present_member') {
          const limit = team.checked_in ? team.present_count : team.total_members;
          return `${count}/${limit}`;
        }
        return String(count);
      });

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
        String(absentCount),
        escapeCSV(presentMembers.map((m) => m.name).join('; ')),
        escapeCSV(absentMembers.map((m) => m.name).join('; ')),
        escapeCSV(team.members.map((m) => `${m.name} (${m.phone})`).join('; ')),
        String(team.breakfast_count),
        String(team.lunch_count),
        String(team.dinner_count),
        String(team.coffee_count),
        ...customEventValues.map((val) => escapeCSV(val)),
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
            className="nirmaan-pill bg-nirmaan-green-dark text-white text-[10px] font-black py-2 px-3 hover:opacity-90 transition-opacity shadow-xs flex-shrink-0 cursor-pointer"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
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
                {activeCustomEvents.map((evt) => (
                  <th key={evt.id} className="p-3.5 text-center whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${evt.color} ${
                        evt.text_color ||
                        (evt.color?.includes('blue') || evt.color?.includes('purple') || evt.color?.includes('dark') || evt.color?.includes('red')
                          ? 'text-white'
                          : 'text-nirmaan-black')
                      }`}
                    >
                      {evt.title}
                    </span>
                  </th>
                ))}
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nirmaan-black/5 font-medium">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={9 + activeCustomEvents.length} className="p-10 text-center text-nirmaan-black/50 font-bold space-y-1">
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
                        {team.track && (
                          <div className="mt-1">
                            <span className="inline-block text-[10px] font-extrabold text-nirmaan-blue bg-nirmaan-blue/10 px-2 py-0.5 rounded-md border border-nirmaan-blue/20">
                              {team.track}
                            </span>
                          </div>
                        )}
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

                      {/* Custom Scan Events */}
                      {activeCustomEvents.map((evt) => {
                        const records = customRecords.filter(
                          (r) => r.event_id === evt.id && r.team_id === team.id
                        );
                        const count = records.reduce((acc, r) => acc + r.count, 0);

                        return (
                          <td key={evt.id} className="p-3.5 text-center">
                            {evt.limit_rule === 'once_per_team' ? (
                              count > 0 ? (
                                <span className="inline-flex items-center gap-1 bg-nirmaan-green-bright/20 text-nirmaan-green-dark border border-nirmaan-green-dark/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Done</span>
                                </span>
                              ) : (
                                <span className="text-nirmaan-black/40 text-[10px] font-bold">0/1</span>
                              )
                            ) : evt.limit_rule === 'per_present_member' ? (
                              <span className="text-xs">
                                <span className="font-bold">{count}</span>
                                <span className="text-nirmaan-black/40 text-[10px]">
                                  /{team.checked_in ? team.present_count : team.total_members}
                                </span>
                              </span>
                            ) : (
                              <span className="font-bold text-xs">{count}</span>
                            )}
                          </td>
                        );
                      })}

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

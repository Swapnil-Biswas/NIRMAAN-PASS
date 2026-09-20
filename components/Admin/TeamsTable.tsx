'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Eye,
  Utensils,
  Coffee,
  Sun,
  Moon,
  Download,
  CheckCircle2,
  XCircle,
  GitMerge,
  Filter,
  Users,
  UserCheck,
} from 'lucide-react';
import { Team, Member, TeamReviewStatus } from '@/types/database';
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
  const [teams, setTeams] = useState<TeamRowData[]>(initialTeams);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'approved' | 'merged_rejected'>('all');
  const [reviewModalTeam, setReviewModalTeam] = useState<TeamRowData | null>(null);
  const [registrationModalTeam, setRegistrationModalTeam] = useState<TeamRowData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Keep local state in sync if prop updates
  React.useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const flaggedCount = teams.filter((t) => t.review_status === 'flagged_duplicate').length;

  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.college.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'flagged') {
      return t.review_status === 'flagged_duplicate';
    }
    if (statusFilter === 'approved') {
      return !t.review_status || t.review_status === 'approved';
    }
    if (statusFilter === 'merged_rejected') {
      return t.review_status === 'merged' || t.review_status === 'rejected';
    }
    return true;
  });

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

  const handleQuickApprove = async (teamId: string) => {
    setReviewLoading(true);
    try {
      const res = await fetch('/api/admin/teams/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          teamId,
          notes: 'Approved by organizer via teams table',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to approve team');
      }
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, review_status: 'approved' } : t))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to approve team');
    } finally {
      setReviewLoading(false);
    }
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
          present_member_ids: presentMemberIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to complete registration check-in');
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
      alert(err.message || 'Error saving registration check-in');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleReviewAction = async (action: 'approve' | 'reject' | 'merge', matchedTeamId?: string) => {
    if (!reviewModalTeam) return;
    setReviewLoading(true);
    setReviewError('');

    try {
      const res = await fetch('/api/admin/teams/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          teamId: reviewModalTeam.id,
          primaryTeamId: matchedTeamId || reviewModalTeam.duplicate_match_team_id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} team`);
      }

      // Update state locally
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === reviewModalTeam.id) {
            return {
              ...t,
              review_status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'merged',
              merged_into_team_id: action === 'merge' ? (matchedTeamId || reviewModalTeam.duplicate_match_team_id || null) : t.merged_into_team_id,
            };
          }
          return t;
        })
      );

      setReviewModalTeam(null);
    } catch (err: any) {
      setReviewError(err.message || 'Error processing review action');
    } finally {
      setReviewLoading(false);
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
      'Review Status',
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
      team.review_status || 'approved',
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

  const matchedTeam = reviewModalTeam?.duplicate_match_team_id
    ? teams.find((t) => t.id === reviewModalTeam.duplicate_match_team_id)
    : null;

  return (
    <div className="w-full space-y-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-nirmaan-black/10 pb-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
          className={`nirmaan-pill text-xs font-bold py-1.5 px-3.5 transition-all ${
            statusFilter === 'all'
              ? 'bg-nirmaan-black text-white shadow-xs'
              : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
          }`}
        >
          All Teams ({teams.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('flagged');
            setPage(1);
          }}
          className={`nirmaan-pill text-xs font-bold py-1.5 px-3.5 transition-all flex items-center gap-1.5 ${
            statusFilter === 'flagged'
              ? 'bg-nirmaan-amber text-nirmaan-black shadow-xs'
              : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Flagged Review</span>
          {flaggedCount > 0 && (
            <span className="bg-nirmaan-black text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {flaggedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('approved');
            setPage(1);
          }}
          className={`nirmaan-pill text-xs font-bold py-1.5 px-3.5 transition-all ${
            statusFilter === 'approved'
              ? 'bg-nirmaan-green-bright text-nirmaan-black shadow-xs'
              : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
          }`}
        >
          Approved Teams
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('merged_rejected');
            setPage(1);
          }}
          className={`nirmaan-pill text-xs font-bold py-1.5 px-3.5 transition-all ${
            statusFilter === 'merged_rejected'
              ? 'bg-nirmaan-red text-white shadow-xs'
              : 'bg-white text-nirmaan-black/70 hover:bg-nirmaan-cream border border-nirmaan-black/10'
          }`}
        >
          Merged / Inactive
        </button>
      </div>

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
                <th className="p-3.5 text-right">Pass / Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nirmaan-black/5 font-medium">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-nirmaan-black/50 font-bold space-y-1">
                    <p className="text-sm text-nirmaan-black/70 font-black uppercase">
                      {search ? `No teams found matching "${search}"` : 'No teams found in this category'}
                    </p>
                    <p className="text-xs font-medium text-nirmaan-black/50">
                      {search ? 'Try clearing your search query.' : 'Teams will appear here as they register.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-nirmaan-cream/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-sm text-nirmaan-black flex items-center gap-1.5">
                        <span>{team.team_name}</span>
                        {team.review_status === 'flagged_duplicate' && (
                          <span className="bg-nirmaan-amber/20 text-nirmaan-black text-[9px] px-1.5 py-0.5 rounded font-black border border-nirmaan-amber/40">
                            FLAGGED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-nirmaan-black/60">
                        {team.college}
                      </div>
                      {team.duplicate_notes && (
                        <div className="text-[10px] text-nirmaan-amber font-semibold mt-0.5 line-clamp-1">
                          Note: {team.duplicate_notes}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      {team.review_status === 'flagged_duplicate' ? (
                        <button
                          type="button"
                          onClick={() => setReviewModalTeam(team)}
                          className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          REVIEW REQUIRED
                        </button>
                      ) : team.review_status === 'rejected' ? (
                        <span className="nirmaan-pill bg-nirmaan-red text-white text-[10px] font-black">
                          <XCircle className="w-3 h-3" />
                          REJECTED
                        </span>
                      ) : team.review_status === 'merged' ? (
                        <span className="nirmaan-pill bg-nirmaan-black/20 text-nirmaan-black/80 text-[10px] font-bold">
                          <GitMerge className="w-3 h-3" />
                          MERGED
                        </span>
                      ) : team.checked_in ? (
                        <span className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black text-[10px] font-black">
                          <ShieldCheck className="w-3 h-3" />
                          CHECKED IN
                        </span>
                      ) : (
                        <span className="nirmaan-pill bg-nirmaan-cream text-nirmaan-black text-[10px] font-bold border border-nirmaan-black/15">
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

                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {team.review_status === 'flagged_duplicate' ? (
                        <>
                          <button
                            type="button"
                            disabled={reviewLoading}
                            onClick={() => handleQuickApprove(team.id)}
                            className="nirmaan-pill bg-nirmaan-green-bright hover:opacity-90 text-nirmaan-black text-[10px] py-1 px-2.5 font-black shadow-xs inline-flex items-center gap-1 cursor-pointer"
                            title="Approve Team Registration"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewModalTeam(team)}
                            className="nirmaan-pill bg-nirmaan-amber hover:bg-nirmaan-amber/80 text-nirmaan-black text-[10px] py-1 px-2.5 font-bold shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            Review
                          </button>
                        </>
                      ) : !team.checked_in && team.review_status !== 'rejected' && team.review_status !== 'merged' ? (
                        <button
                          type="button"
                          onClick={() => setRegistrationModalTeam(team)}
                          className="nirmaan-pill bg-nirmaan-green-dark hover:opacity-90 text-white text-[10px] py-1 px-2.5 font-black shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          title="Approve On-Desk Registration & Check-In"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Check-In</span>
                        </button>
                      ) : null}

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

      {/* Duplicate Review Modal */}
      {reviewModalTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nirmaan-black/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-nirmaan-black rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-nirmaan-black/10 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-nirmaan-amber" />
                <h3 className="font-display text-base font-black uppercase text-nirmaan-black">
                  DUPLICATE REGISTRATION REVIEW
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalTeam(null)}
                className="text-nirmaan-black/50 hover:text-nirmaan-black font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            {reviewError && (
              <div className="p-3 bg-nirmaan-red/10 border border-nirmaan-red/30 rounded-xl text-xs font-bold text-nirmaan-red">
                {reviewError}
              </div>
            )}

            {/* Flag Reason Banner */}
            <div className="bg-nirmaan-amber/10 border border-nirmaan-amber/40 p-3.5 rounded-xl text-xs font-medium text-nirmaan-black space-y-1">
              <div className="font-bold text-nirmaan-black uppercase flex items-center gap-1.5">
                <span>Detection Reason:</span>
              </div>
              <p className="text-nirmaan-black/80">{reviewModalTeam.duplicate_notes || 'Potential duplicate match detected.'}</p>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Flagged Team */}
              <div className="p-4 rounded-xl border-2 border-nirmaan-amber/50 bg-nirmaan-cream/30 space-y-2.5">
                <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[9px] font-black">
                  NEW REGISTRATION (UNDER REVIEW)
                </span>
                <div>
                  <h4 className="font-display font-black text-sm uppercase text-nirmaan-black">
                    {reviewModalTeam.team_name}
                  </h4>
                  <p className="text-nirmaan-black/60 font-semibold">{reviewModalTeam.college}</p>
                  <p className="text-[11px] text-nirmaan-blue font-bold mt-0.5">{reviewModalTeam.track || 'Track not specified'}</p>
                </div>
                <div className="space-y-1 pt-1 border-t border-nirmaan-black/10">
                  <p className="font-bold text-[10px] uppercase text-nirmaan-black/50">Members ({reviewModalTeam.members.length}):</p>
                  {reviewModalTeam.members.map((m) => (
                    <div key={m.id} className="text-[11px] text-nirmaan-black/80">
                      • <span className="font-bold">{m.name}</span> ({m.email})
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Existing Team (if available) */}
              <div className="p-4 rounded-xl border border-nirmaan-black/15 bg-white space-y-2.5">
                <span className="nirmaan-pill bg-nirmaan-blue text-white text-[9px] font-black">
                  MATCHED EXISTING TEAM
                </span>
                {matchedTeam ? (
                  <>
                    <div>
                      <h4 className="font-display font-black text-sm uppercase text-nirmaan-black">
                        {matchedTeam.team_name}
                      </h4>
                      <p className="text-nirmaan-black/60 font-semibold">{matchedTeam.college}</p>
                      <p className="text-[11px] text-nirmaan-blue font-bold mt-0.5">{matchedTeam.track || 'Track not specified'}</p>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-nirmaan-black/10">
                      <p className="font-bold text-[10px] uppercase text-nirmaan-black/50">Members ({matchedTeam.members.length}):</p>
                      {matchedTeam.members.map((m) => (
                        <div key={m.id} className="text-[11px] text-nirmaan-black/80">
                          • <span className="font-bold">{m.name}</span> ({m.email})
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-nirmaan-black/50 font-medium py-4">
                    Matched team details not linked or from historical seed data.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-nirmaan-black/10">
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewAction('approve')}
                className="nirmaan-pill bg-nirmaan-green-bright text-nirmaan-black font-black text-xs py-2.5 px-4 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                APPROVE (LEGITIMATE TEAM)
              </button>

              {matchedTeam && (
                <button
                  type="button"
                  disabled={reviewLoading}
                  onClick={() => handleReviewAction('merge', matchedTeam.id)}
                  className="nirmaan-pill bg-nirmaan-blue text-white font-black text-xs py-2.5 px-4 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <GitMerge className="w-4 h-4" />
                  MERGE WITH MATCH
                </button>
              )}

              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReviewAction('reject')}
                className="nirmaan-pill bg-nirmaan-red text-white font-black text-xs py-2.5 px-4 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                REJECT DUPLICATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-Desk Registration & Check-In Approval Modal */}
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



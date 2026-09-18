'use client';

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Eye, QrCode, Utensils, Coffee, Sun, Moon } from 'lucide-react';
import { Team, Member } from '@/types/database';

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

  const filteredTeams = teams.filter(
    (t) =>
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.college.toLowerCase().includes(search.toLowerCase()) ||
      t.qr_token.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search team by name, college, or token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 rounded-full border border-nirmaan-black/20 bg-white font-medium text-xs outline-none focus:border-nirmaan-black"
        />
        <span className="text-xs font-bold text-nirmaan-black/60 hidden sm:inline">
          Showing {filteredTeams.length} of {teams.length} teams
        </span>
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
                <th className="p-3.5 text-center">Coffee</th>
                <th className="p-3.5 text-right">QR Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nirmaan-black/5 font-medium">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-nirmaan-black/50 font-bold">
                    No teams found matching search.
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => (
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

                    <td className="p-3.5 text-right font-mono text-[11px] text-nirmaan-black/60 select-all">
                      {team.qr_token}
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

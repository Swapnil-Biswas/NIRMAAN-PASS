import React from 'react';
import { findTeamById, findTeamByToken, getTeamMembers, getAllTeams, getAnnouncements } from '@/lib/data/store';
import AdminTeamPreview from '@/components/Admin/AdminTeamPreview';
import { Team, Member } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface AdminPassPageProps {
  searchParams?: {
    teamId?: string;
    id?: string;
    token?: string;
  };
}

export default async function AdminPassDashboardPage({ searchParams }: AdminPassPageProps) {
  const allTeams = await getAllTeams();
  const announcements = await getAnnouncements(true);

  const teamId = searchParams?.teamId || searchParams?.id;
  const token = searchParams?.token;

  let team: Team | null = null;
  let members: Member[] = [];

  if (teamId) {
    team = await findTeamById(teamId);
  } else if (token) {
    team = await findTeamByToken(token);
  } else if (allTeams.length > 0) {
    team = allTeams[0];
  }

  if (team) {
    members = await getTeamMembers(team.id);
  }

  const teamWithMembers = team
    ? {
        ...team,
        members,
        present_count: members.filter((m) => m.present).length,
        total_members: members.length,
      }
    : null;

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full">
      <AdminTeamPreview
        currentTeam={teamWithMembers}
        allTeams={allTeams.map((t) => ({
          id: t.id,
          team_name: t.team_name,
          college: t.college,
          checked_in: t.checked_in,
        }))}
        announcements={announcements}
      />
    </main>
  );
}

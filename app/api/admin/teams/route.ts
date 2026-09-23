import { NextRequest, NextResponse } from 'next/server';
import { getAllTeams, findTeamByToken, getTeamMembers, deleteTeam, deleteAllTeams } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (token) {
      const team = await findTeamByToken(token);
      if (!team) {
        return NextResponse.json({ success: false, message: 'Team not found' }, { status: 404 });
      }
      const members = await getTeamMembers(team.id);
      return NextResponse.json({ success: true, team, members });
    }

    const teams = await getAllTeams();
    return NextResponse.json({ success: true, teams });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const clearAll = searchParams.get('all') === 'true';
    const teamId = searchParams.get('id');

    if (clearAll) {
      const success = await deleteAllTeams();
      if (!success) {
        return NextResponse.json(
          { success: false, message: 'Failed to delete all teams' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, message: 'All team data successfully deleted' });
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: 'Team ID required' },
        { status: 400 }
      );
    }

    const success = await deleteTeam(teamId);
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Failed to delete team' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Team successfully deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Error deleting team data' },
      { status: 500 }
    );
  }
}

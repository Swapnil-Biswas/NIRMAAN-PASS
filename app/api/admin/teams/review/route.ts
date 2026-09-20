import { NextRequest, NextResponse } from 'next/server';
import { updateTeamReviewStatus, mergeDuplicateTeam, findTeamById } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';
import { TeamReviewStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, teamId, duplicateTeamId, primaryTeamId, notes } = body;

    if (action === 'approve') {
      if (!teamId) {
        return NextResponse.json({ success: false, message: 'teamId is required' }, { status: 400 });
      }
      const updated = await updateTeamReviewStatus(teamId, 'approved', notes || 'Approved by organizer');
      if (!updated) {
        return NextResponse.json({ success: false, message: 'Team not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Team '${updated.team_name}' has been approved.`,
        team: updated,
      });
    }

    if (action === 'reject') {
      if (!teamId) {
        return NextResponse.json({ success: false, message: 'teamId is required' }, { status: 400 });
      }
      const updated = await updateTeamReviewStatus(
        teamId,
        'rejected',
        notes || 'Rejected as duplicate registration by organizer'
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: 'Team not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Team '${updated.team_name}' has been rejected and pass revoked.`,
        team: updated,
      });
    }

    if (action === 'merge') {
      const targetDupId = duplicateTeamId || teamId;
      if (!targetDupId || !primaryTeamId) {
        return NextResponse.json(
          { success: false, message: 'Both duplicateTeamId and primaryTeamId are required for merge' },
          { status: 400 }
        );
      }

      const result = await mergeDuplicateTeam(targetDupId, primaryTeamId, notes);
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        primaryTeam: result.primaryTeam,
        duplicateTeam: result.duplicateTeam,
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action. Must be 'approve', 'reject', or 'merge'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Admin team review error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error processing review.' },
      { status: 500 }
    );
  }
}

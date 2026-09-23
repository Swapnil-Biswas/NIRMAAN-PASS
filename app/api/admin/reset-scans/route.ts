import { NextRequest, NextResponse } from 'next/server';
import { resetAllScansAndAttendance, resetTeamAttendance } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await verifyAdminSession(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const teamId = body?.teamId;

    if (teamId) {
      await resetTeamAttendance(teamId);
      return NextResponse.json({
        success: true,
        message: `Attendance and scan logs for team ${teamId} have been reset.`,
      });
    }

    const result = await resetAllScansAndAttendance();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to reset scans.' },
      { status: 500 }
    );
  }
}

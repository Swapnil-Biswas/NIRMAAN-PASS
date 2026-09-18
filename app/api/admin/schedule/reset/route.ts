import { NextRequest, NextResponse } from 'next/server';
import { resetSchedule } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to reset schedule' },
        { status: 401 }
      );
    }

    const schedule = await resetSchedule();
    return NextResponse.json({ success: true, message: 'Schedule reset to official defaults', schedule });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to reset schedule' },
      { status: 500 }
    );
  }
}

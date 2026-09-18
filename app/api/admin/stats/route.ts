import { NextRequest, NextResponse } from 'next/server';
import { getEventStatistics } from '@/lib/data/store';
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
    const stats = await getEventStatistics();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

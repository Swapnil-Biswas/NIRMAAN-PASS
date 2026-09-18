import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const schedule = await getSchedule();
    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/data/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const schedule = await getSchedule();
    const response = NextResponse.json({ success: true, schedule });
    response.headers.set('Cache-Control', 'public, max-age=10, s-maxage=15, stale-while-revalidate=60');
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

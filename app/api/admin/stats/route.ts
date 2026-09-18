import { NextResponse } from 'next/server';
import { getEventStatistics } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getEventStatistics();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

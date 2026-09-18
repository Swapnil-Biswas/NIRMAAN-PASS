import { NextRequest, NextResponse } from 'next/server';
import { getAnnouncements, createAnnouncement } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';
    const announcements = await getAnnouncements(!all);
    return NextResponse.json({ success: true, announcements });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, priority, published } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: 'Title and message are required' },
        { status: 400 }
      );
    }

    const newAnnouncement = await createAnnouncement({
      title: title.trim().toUpperCase(),
      message: message.trim(),
      priority: priority || 'normal',
      published: published !== undefined ? published : true,
    });

    return NextResponse.json({ success: true, announcement: newAnnouncement }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create announcement' },
      { status: 500 }
    );
  }
}

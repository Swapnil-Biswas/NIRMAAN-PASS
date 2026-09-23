import { NextRequest, NextResponse } from 'next/server';
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';
    const announcements = await getAnnouncements(!all);
    const response = NextResponse.json({ success: true, announcements });
    response.headers.set('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=59');
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to broadcast' },
        { status: 401 }
      );
    }
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

export async function DELETE(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to delete announcements' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Announcement ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteAnnouncement(id);
    return NextResponse.json({ success: deleted, deletedId: id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete announcement' },
      { status: 500 }
    );
  }
}

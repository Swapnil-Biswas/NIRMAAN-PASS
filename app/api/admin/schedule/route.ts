import { NextRequest, NextResponse } from 'next/server';
import {
  getSchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  reorderSchedule,
} from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to modify schedule' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { time, title, tag, color, text_color, order_index } = body;

    if (!time || !title) {
      return NextResponse.json(
        { success: false, message: 'Time and event title are required' },
        { status: 400 }
      );
    }

    const newItem = await createScheduleItem({
      time: time.trim(),
      title: title.trim().toUpperCase(),
      tag: (tag || 'TIMELINE').trim().toUpperCase(),
      color: color || 'bg-nirmaan-blue',
      text_color: text_color,
      order_index: typeof order_index === 'number' ? order_index : undefined as any,
    });

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create schedule item' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to modify schedule' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Check if batch reordering
    if (Array.isArray(body.reorder)) {
      await reorderSchedule(body.reorder);
      const updatedSchedule = await getSchedule();
      return NextResponse.json({ success: true, schedule: updatedSchedule });
    }

    // Individual item update
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Schedule item ID is required' },
        { status: 400 }
      );
    }

    const updated = await updateScheduleItem(id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Schedule item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update schedule item' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required to modify schedule' },
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
        { success: false, message: 'Schedule item ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteScheduleItem(id);
    return NextResponse.json({ success: deleted, deletedId: id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete schedule item' },
      { status: 500 }
    );
  }
}

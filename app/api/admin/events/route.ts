import { NextRequest, NextResponse } from 'next/server';
import { getCustomScanEvents, createCustomScanEvent, deleteCustomScanEvent } from '@/lib/data/store';
import { verifyAdminSession } from '@/lib/auth/admin';
import { LimitRule } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const events = await getCustomScanEvents();
    return NextResponse.json({ success: true, events });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch scan events' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, description, limit_rule, color, text_color, icon, order_index } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, message: 'Event title is required' },
        { status: 400 }
      );
    }

    const validRules: LimitRule[] = ['once_per_team', 'per_present_member', 'unlimited'];
    const rule: LimitRule = validRules.includes(limit_rule) ? limit_rule : 'per_present_member';

    const event = await createCustomScanEvent({
      title: title.trim(),
      description: description || null,
      limit_rule: rule,
      color: color || 'bg-nirmaan-amber',
      text_color: text_color || undefined,
      icon: icon || 'Sparkles',
      active: true,
      order_index: typeof order_index === 'number' ? order_index : 0,
    });

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create scan event' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'Event ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteCustomScanEvent(eventId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Event not found or failed to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Scan event deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Error deleting scan event' },
      { status: 500 }
    );
  }
}

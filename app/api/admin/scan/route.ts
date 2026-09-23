import { NextRequest, NextResponse } from 'next/server';
import {
  processMealScan,
  processCoffeeScan,
  processRegistration,
  processCustomScan,
  findTeamByToken,
  getTeamMembers,
  getCustomScanRecords,
} from '@/lib/data/store';
import { sanitizeQRToken } from '@/lib/qr/token';
import { ScanPurpose, MealType } from '@/types/database';
import { verifyAdminSession } from '@/lib/auth/admin';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`scan:${ip}`, 120, 60 * 1000); // 120 scans per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error_code: 'RATE_LIMITED', message: 'Scan rate limit exceeded. Please slow down.' },
        { status: 429 }
      );
    }

    if (!verifyAdminSession(req)) {
      return NextResponse.json(
        { success: false, error_code: 'UNAUTHORIZED', message: 'Organizer authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { qr_token, purpose, event_id, count, present_member_ids, action } = body;

    if (!qr_token || typeof qr_token !== 'string') {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_QR', message: 'QR token is required' },
        { status: 400 }
      );
    }

    const cleanToken = sanitizeQRToken(qr_token);
    if (!cleanToken) {
      return NextResponse.json(
        { success: false, error_code: 'INVALID_QR', message: 'Invalid QR token provided' },
        { status: 400 }
      );
    }

    // Lookup action: volunteer just scanned, return preview details before confirming
    if (action === 'lookup') {
      const team = await findTeamByToken(cleanToken);
      if (!team) {
        return NextResponse.json(
          { success: false, error_code: 'INVALID_QR', message: 'Invalid QR — Team not found.' },
          { status: 404 }
        );
      }
      const members = await getTeamMembers(team.id);
      const presentCount = members.filter((m) => m.present).length;

      // Also fetch custom records for this team if an event_id or custom purpose is passed
      const targetEventId = event_id || (purpose && !['registration', 'breakfast', 'lunch', 'dinner', 'coffee'].includes(purpose) ? purpose : null);
      let customEventRecords: any[] = [];
      if (targetEventId) {
        customEventRecords = await getCustomScanRecords(targetEventId, team.id);
      }

      return NextResponse.json({
        success: true,
        team,
        members,
        present_count: presentCount,
        total_members: members.length,
        custom_records: customEventRecords,
      });
    }

    // Execute scan action based on purpose or event_id
    const targetEventId = event_id || (purpose && !['registration', 'breakfast', 'lunch', 'dinner', 'coffee'].includes(purpose) ? purpose : null);
    if (targetEventId) {
      const requestedCount = typeof count === 'number' && count > 0 ? count : 1;
      const memberIds = Array.isArray(present_member_ids) ? present_member_ids : undefined;
      const result = await processCustomScan(cleanToken, targetEventId, requestedCount, memberIds);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (purpose === 'registration') {
      const memberIds = Array.isArray(present_member_ids) ? present_member_ids : [];
      const result = await processRegistration(cleanToken, memberIds);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (purpose === 'breakfast' || purpose === 'lunch' || purpose === 'dinner') {
      const result = await processMealScan(cleanToken, purpose as MealType);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (purpose === 'coffee') {
      const result = await processCoffeeScan(cleanToken);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { success: false, error_code: 'INVALID_PURPOSE', message: 'Invalid scan purpose provided' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error_code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

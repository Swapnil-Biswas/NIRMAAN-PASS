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
import { logEvent } from '@/lib/logging/logger';

export async function POST(req: NextRequest) {
  const startTime = performance.now();
  const ip = getClientIp(req);

  try {
    const rateLimit = checkRateLimit(`scan:${ip}`, 600, 60 * 1000); // 600 scans per minute for high-concurrency queues
    if (!rateLimit.allowed) {
      logEvent({
        route: '/api/admin/scan',
        operation: 'rate_limit',
        success: false,
        durationMs: performance.now() - startTime,
        errorCode: 'RATE_LIMITED',
        message: 'Scan rate limit exceeded',
        ip,
      });
      return NextResponse.json(
        { success: false, error_code: 'RATE_LIMITED', message: 'Scan rate limit exceeded. Please slow down.' },
        { status: 429 }
      );
    }

    if (!verifyAdminSession(req)) {
      logEvent({
        route: '/api/admin/scan',
        operation: 'auth_check',
        success: false,
        durationMs: performance.now() - startTime,
        errorCode: 'UNAUTHORIZED',
        message: 'Organizer authentication required',
        ip,
      });
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
        logEvent({
          route: '/api/admin/scan',
          operation: 'lookup',
          success: false,
          durationMs: performance.now() - startTime,
          errorCode: 'INVALID_QR',
          message: 'Team not found for token',
          ip,
        });
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

      logEvent({
        route: '/api/admin/scan',
        operation: 'lookup',
        success: true,
        durationMs: performance.now() - startTime,
        teamId: team.id,
        teamName: team.team_name,
        ip,
      });

      return NextResponse.json({
        success: true,
        team,
        members,
        present_count: presentCount,
        total_members: members.length,
        custom_records: customEventRecords,
      });
    }

    const effectivePurpose = purpose || (action && action !== 'lookup' ? action : null);

    // Execute scan action based on purpose or event_id
    const targetEventId = event_id || (effectivePurpose && !['registration', 'breakfast', 'lunch', 'dinner', 'coffee'].includes(effectivePurpose) ? effectivePurpose : null);
    if (targetEventId) {
      const requestedCount = typeof count === 'number' && count > 0 ? count : 1;
      const memberIds = Array.isArray(present_member_ids) ? present_member_ids : undefined;
      const result = await processCustomScan(cleanToken, targetEventId, requestedCount, memberIds);

      logEvent({
        route: '/api/admin/scan',
        operation: 'custom_scan',
        success: result.success,
        durationMs: performance.now() - startTime,
        teamId: result.team_id,
        teamName: result.team_name,
        eventId: targetEventId,
        errorCode: result.error_code,
        message: result.message,
        ip,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (effectivePurpose === 'registration') {
      const memberIds = Array.isArray(present_member_ids) ? present_member_ids : [];
      const result = await processRegistration(cleanToken, memberIds);

      logEvent({
        route: '/api/admin/scan',
        operation: 'registration',
        success: result.success,
        durationMs: performance.now() - startTime,
        teamId: result.team_id,
        teamName: result.team_name,
        errorCode: result.error_code,
        message: result.message,
        ip,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (effectivePurpose === 'breakfast' || effectivePurpose === 'lunch' || effectivePurpose === 'dinner') {
      const result = await processMealScan(cleanToken, effectivePurpose as MealType);

      logEvent({
        route: '/api/admin/scan',
        operation: 'meal_scan',
        mealType: effectivePurpose,
        success: result.success,
        durationMs: performance.now() - startTime,
        teamId: result.team_id,
        teamName: result.team_name,
        errorCode: result.error_code,
        message: result.message,
        ip,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (effectivePurpose === 'coffee') {
      const result = await processCoffeeScan(cleanToken);

      logEvent({
        route: '/api/admin/scan',
        operation: 'coffee_scan',
        success: result.success,
        durationMs: performance.now() - startTime,
        teamId: result.team_id,
        teamName: result.team_name,
        errorCode: result.error_code,
        message: result.message,
        ip,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    logEvent({
      route: '/api/admin/scan',
      operation: 'unknown_purpose',
      success: false,
      durationMs: performance.now() - startTime,
      errorCode: 'INVALID_PURPOSE',
      message: `Invalid purpose: ${effectivePurpose}`,
      ip,
    });

    return NextResponse.json(
      { success: false, error_code: 'INVALID_PURPOSE', message: 'Invalid scan purpose provided' },
      { status: 400 }
    );
  } catch (error: any) {
    logEvent({
      route: '/api/admin/scan',
      operation: 'exception',
      success: false,
      durationMs: performance.now() - startTime,
      errorCode: 'SERVER_ERROR',
      message: error.message,
      ip,
    });
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error_code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

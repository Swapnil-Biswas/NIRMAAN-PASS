import { NextRequest, NextResponse } from 'next/server';
import {
  getExpectedAdminCode,
  createAdminSessionToken,
  verifyAdminSession,
  getInactivityTimeoutMs,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/auth
 * Authenticates admin via access code and issues an HMAC-signed session cookie
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    const expected = getExpectedAdminCode();
    if (!code || typeof code !== 'string' || code.trim() !== expected) {
      return NextResponse.json(
        { success: false, message: 'Invalid Organizer Access Code. Access Denied.' },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken();
    const response = NextResponse.json({
      success: true,
      message: 'Organizer session authenticated successfully.',
    });

    // Set secure HTTP-only browser session cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Authentication error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/auth
 * Session heartbeat / keepalive: Refreshes the session token during active user interactions
 */
export async function PUT(req: NextRequest) {
  try {
    const isValid = verifyAdminSession(req);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Session expired or invalid.' },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken();
    const response = NextResponse.json({
      success: true,
      message: 'Session refreshed.',
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Heartbeat error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth
 * Logs out / locks admin console and deletes the session cookie
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Organizer session locked.',
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

/**
 * GET /api/admin/auth
 * Checks if current admin session is valid and returns timeout parameters
 */
export async function GET(req: NextRequest) {
  const isAuth = verifyAdminSession(req);
  return NextResponse.json({
    authenticated: isAuth,
    inactivityTimeoutMs: getInactivityTimeoutMs(),
  });
}

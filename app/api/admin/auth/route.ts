import { NextRequest, NextResponse } from 'next/server';
import { getExpectedAdminCode, getAdminSessionToken, verifyAdminSession, ADMIN_COOKIE_NAME } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

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

    const response = NextResponse.json({
      success: true,
      message: 'Organizer session authenticated successfully.',
    });

    // Set HTTP-only session cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: getAdminSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 2, // 48 hours for hackathon duration
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Authentication error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Organizer session locked.',
  });

  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}

export async function GET(req: NextRequest) {
  const isAuth = verifyAdminSession(req);
  return NextResponse.json({ authenticated: isAuth });
}

import { NextRequest, NextResponse } from 'next/server';
import { findTeamByMemberEmail } from '@/lib/data/store';
import { normalizeEmail } from '@/lib/registration';
import { createTeamSessionToken, TEAM_COOKIE_NAME, MAX_TEAM_SESSION_LIFETIME_MS } from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const ipRateLimit = checkRateLimit(`login_ip:${ip}`, 300, 60 * 1000); // 300 attempts per min per venue IP
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many login attempts from this network. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);
    const emailRateLimit = checkRateLimit(`login_email:${cleanEmail}`, 15, 60 * 1000); // 15 attempts per min per email
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many login attempts for this email. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const match = await findTeamByMemberEmail(cleanEmail);

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message: 'No registered team found matching this email. Please check your spelling or activate your team.',
        },
        { status: 404 }
      );
    }

    const { team: matchedTeam } = match;

    // Generate tamper-proof signed session token
    const token = createTeamSessionToken({
      teamId: matchedTeam.id,
      email: cleanEmail,
      token: matchedTeam.qr_token,
      team_name: matchedTeam.team_name,
    });

    const response = NextResponse.json({
      success: true,
      token: matchedTeam.qr_token,
      team_name: matchedTeam.team_name,
      message: 'Login successful.',
    });

    // Set signed secure HTTP-only local session cookie
    response.cookies.set({
      name: TEAM_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(MAX_TEAM_SESSION_LIFETIME_MS / 1000),
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Login error occurred.' },
      { status: 500 }
    );
  }
}

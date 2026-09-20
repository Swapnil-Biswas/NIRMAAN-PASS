import { NextRequest, NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/data/store';
import { normalizeEmail } from '@/lib/registration';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);
    const teams = await getAllTeams();
    const matchedTeam = teams.find((t) =>
      t.members.some((m) => m?.email && normalizeEmail(m.email) === cleanEmail)
    );

    if (!matchedTeam) {
      return NextResponse.json(
        {
          success: false,
          message: 'No registered team found matching this email. Please check your spelling or activate your team.',
        },
        { status: 404 }
      );
    }

    // Create team session response
    const response = NextResponse.json({
      success: true,
      token: matchedTeam.qr_token,
      team_name: matchedTeam.team_name,
      message: 'Login successful.',
    });

    // Set local session cookie
    response.cookies.set({
      name: 'nirmaan_team_session',
      value: JSON.stringify({
        teamId: matchedTeam.id,
        email: cleanEmail,
        token: matchedTeam.qr_token,
        team_name: matchedTeam.team_name,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Login error occurred.' },
      { status: 500 }
    );
  }
}

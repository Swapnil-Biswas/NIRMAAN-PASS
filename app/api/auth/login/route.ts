import { NextRequest, NextResponse } from 'next/server';
import { getAllTeams, getTeamMembers } from '@/lib/data/store';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth first if configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !url.includes('placeholder') && password) {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (!authError && authData.user) {
          // Success via Supabase
          const teams = await getAllTeams();
          const team = teams.find(
            (t) =>
              t.auth_id === authData.user.id ||
              t.members.some((m) => m.email?.toLowerCase() === cleanEmail)
          );
          return NextResponse.json({
            success: true,
            token: team?.qr_token || '',
            message: 'Signed in successfully via Supabase.',
          });
        }
      } catch {}
    }

    // 2. Standalone / Local Roster Authentication
    const teams = await getAllTeams();
    const matchedTeam = teams.find((t) =>
      t.members.some((m) => m.email?.toLowerCase() === cleanEmail)
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
      maxAge: 60 * 60 * 24 * 2, // 48 hours for event duration
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Login error occurred.' },
      { status: 500 }
    );
  }
}

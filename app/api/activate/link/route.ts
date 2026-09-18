import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/activate/link
 * Link a newly created Supabase Auth or local account to their pre-created team record.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, auth_id } = await req.json();

    if (!email || !auth_id) {
      return NextResponse.json(
        { success: false, message: 'Email and auth_id are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase if configured
    const hasConfig = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    );

    let linkedTeam: any = null;

    if (hasConfig) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();

        // Find team by member email
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('team_id')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        if (member && !memberError) {
          // Update the team's auth_id in Supabase
          const { data: updatedTeam, error: updateError } = await supabase
            .from('teams')
            .update({ auth_id: auth_id, updated_at: new Date().toISOString() })
            .eq('id', member.team_id)
            .select('*')
            .maybeSingle();

          if (!updateError && updatedTeam) {
            linkedTeam = updatedTeam;
          }
        }
      } catch {}
    }

    // 2. Local/Mock Store link and fallback
    const { getAllTeams } = await import('@/lib/data/store');
    const allTeams = await getAllTeams();
    const mockTeam = allTeams.find((t) =>
      t.members.some((m) => m.email.toLowerCase() === cleanEmail)
    );

    if (mockTeam) {
      mockTeam.auth_id = auth_id;
      if (!linkedTeam) {
        linkedTeam = mockTeam;
      }
    }

    if (!linkedTeam) {
      return NextResponse.json(
        { success: false, message: 'Team not found for this email.' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      token: linkedTeam.qr_token,
      team_name: linkedTeam.team_name,
      message: 'Team account activated and linked.',
    });

    // Set team session cookie
    response.cookies.set({
      name: 'nirmaan_team_session',
      value: JSON.stringify({
        teamId: linkedTeam.id,
        email: cleanEmail,
        token: linkedTeam.qr_token,
        team_name: linkedTeam.team_name,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 2,
    });

    return response;
  } catch (error: any) {
    console.error('Activate link error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

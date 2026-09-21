import { NextRequest, NextResponse } from 'next/server';
import { createTeamSessionToken, TEAM_COOKIE_NAME, MAX_TEAM_SESSION_LIFETIME_MS } from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

/**
 * POST /api/activate/link
 * Link a newly created Supabase Auth or local account to their pre-created team record.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`activate_link:${ip}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const { email, auth_id } = await req.json();

    if (!email || !auth_id || typeof email !== 'string' || typeof auth_id !== 'string') {
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
          // Verify the team isn't already claimed by another auth_id
          const { data: existingTeam } = await supabase
            .from('teams')
            .select('*')
            .eq('id', member.team_id)
            .maybeSingle();

          if (existingTeam && existingTeam.auth_id && existingTeam.auth_id !== auth_id) {
            return NextResponse.json(
              { success: false, message: 'This team is already linked to another account. Please log in.' },
              { status: 409 }
            );
          }

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
    const { getAllTeams, findTeamById, updateTeamAuthId } = await import('@/lib/data/store');
    const allTeams = await getAllTeams();
    const mockTeam = allTeams.find((t) =>
      t.members.some((m) => m.email.toLowerCase() === cleanEmail)
    );

    if (mockTeam) {
      const liveTeam = await findTeamById(mockTeam.id);
      if (liveTeam && liveTeam.auth_id && liveTeam.auth_id !== auth_id) {
        return NextResponse.json(
          { success: false, message: 'This team is already linked to another account. Please log in.' },
          { status: 409 }
        );
      }
      await updateTeamAuthId(mockTeam.id, auth_id);
      mockTeam.auth_id = auth_id;
      if (!linkedTeam) {
        linkedTeam = liveTeam ? { ...liveTeam, auth_id } : mockTeam;
      }
    }

    if (!linkedTeam) {
      return NextResponse.json(
        { success: false, message: 'Team not found for this email.' },
        { status: 404 }
      );
    }

    const token = createTeamSessionToken({
      teamId: linkedTeam.id,
      email: cleanEmail,
      token: linkedTeam.qr_token,
      team_name: linkedTeam.team_name,
    });

    const response = NextResponse.json({
      success: true,
      token: linkedTeam.qr_token,
      team_name: linkedTeam.team_name,
      message: 'Team account activated and linked.',
    });

    // Set signed secure team session cookie
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
    console.error('Activate link error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

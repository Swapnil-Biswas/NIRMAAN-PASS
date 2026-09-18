import { NextRequest, NextResponse } from 'next/server';
import { findTeamByToken, getAllTeams } from '@/lib/data/store';

/**
 * POST /api/activate/verify
 * Verify that a team exists by looking up the leader's email in the members table.
 * The team must not already have an auth_id linked.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check against Supabase first, then fallback to mock
    let foundTeam = null;
    let memberCount = 0;

    // Try Supabase
    try {
      const hasConfig = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
      );

      if (hasConfig) {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();

        // Find a member with this email
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('team_id')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        if (member && !memberError) {
          // Get the team
          const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', member.team_id)
            .maybeSingle();

          if (team && !teamError) {
            // Check if already activated
            if (team.auth_id) {
              return NextResponse.json(
                { success: false, message: 'This team has already been activated. Please log in instead.' },
                { status: 409 }
              );
            }

            // Count members
            const { count } = await supabase
              .from('members')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id);

            foundTeam = team;
            memberCount = count || 0;
          }
        }
      }
    } catch {
      // Fallback to mock store
    }

    // Fallback: check mock store
    if (!foundTeam) {
      const allTeams = await getAllTeams();
      for (const team of allTeams) {
        const hasMember = team.members.some(
          (m) => m.email.toLowerCase() === cleanEmail
        );
        if (hasMember) {
          foundTeam = team;
          memberCount = team.total_members;
          break;
        }
      }
    }

    if (!foundTeam) {
      return NextResponse.json(
        { success: false, message: 'No team found with this email. Please check the email address and try again.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      team_name: foundTeam.team_name,
      college: foundTeam.college,
      member_count: memberCount,
    });
  } catch (error: any) {
    console.error('Activate verify error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

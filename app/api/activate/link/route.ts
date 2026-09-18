import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/activate/link
 * Link a newly created Supabase Auth user to their pre-created team record.
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

    // Must have Supabase config for this to work
    const hasConfig = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
    );

    if (!hasConfig) {
      // In demo/mock mode, just return success
      return NextResponse.json({
        success: true,
        message: 'Team linked (demo mode).',
      });
    }

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
      const { error: updateError } = await supabase
        .from('teams')
        .update({ auth_id: auth_id, updated_at: new Date().toISOString() })
        .eq('id', member.team_id)
        .is('auth_id', null); // Only link if not already linked

      if (updateError) {
        console.error('Link error:', updateError);
        return NextResponse.json(
          { success: false, message: 'Failed to link account. The team may already be activated.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Team account activated and linked.',
      });
    }

    // Fallback: check and link in local/mock store
    const { getAllTeams } = await import('@/lib/data/store');
    const allTeams = await getAllTeams();
    const mockTeam = allTeams.find((t) =>
      t.members.some((m) => m.email.toLowerCase() === cleanEmail)
    );

    if (mockTeam) {
      if (mockTeam.auth_id && mockTeam.auth_id !== auth_id) {
        return NextResponse.json(
          { success: false, message: 'This team has already been activated. Please log in instead.' },
          { status: 409 }
        );
      }
      mockTeam.auth_id = auth_id;
      return NextResponse.json({
        success: true,
        message: 'Team account activated and linked.',
      });
    }

    return NextResponse.json(
      { success: false, message: 'Team not found for this email.' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Activate link error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

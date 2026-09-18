import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Team, Member } from '@/types/database';

/**
 * Get the current authenticated user, or null if not logged in.
 * Supports both standalone local team session cookie and Supabase Auth.
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();

    // 1. Check local team session cookie
    const localSession = cookieStore.get('nirmaan_team_session')?.value;
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        return {
          id: parsed.teamId,
          email: parsed.email,
          user_metadata: {
            team_id: parsed.teamId,
            team_name: parsed.team_name,
            token: parsed.token,
          },
        } as any;
      } catch {}
    }

    // 2. Check Supabase session if configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !url.includes('placeholder')) {
      const supabase = createClient(cookieStore);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) return user;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the team associated with the current authenticated user.
 * Returns null if not logged in or no team found.
 */
export async function getTeamForUser(): Promise<{ team: Team; members: Member[] } | null> {
  try {
    const cookieStore = await cookies();

    // 1. Check local team session cookie first
    const localSession = cookieStore.get('nirmaan_team_session')?.value;
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        const { findTeamByToken, getAllTeams, getTeamMembers } = await import('@/lib/data/store');
        if (parsed.token) {
          const team = await findTeamByToken(parsed.token);
          if (team) {
            const members = await getTeamMembers(team.id);
            return { team, members };
          }
        }
        const allTeams = await getAllTeams();
        const matched = allTeams.find(
          (t) =>
            t.id === parsed.teamId ||
            (parsed.email && t.members.some((m) => m.email?.toLowerCase() === parsed.email.toLowerCase()))
        );
        if (matched) {
          return { team: matched, members: matched.members };
        }
      } catch {}
    }

    // 2. Check Supabase session if configured
    const user = await getSession();
    if (!user) return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !url.includes('placeholder')) {
      try {
        const supabase = createClient(cookieStore);
        const { data: team, error } = await supabase
          .from('teams')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (!error && team) {
          const { data: members } = await supabase
            .from('members')
            .select('*')
            .eq('team_id', team.id)
            .order('created_at', { ascending: true });

          return {
            team: team as Team,
            members: (members || []) as Member[],
          };
        }
      } catch {}
    }

    // 3. Fallback: check local/mock store by auth_id or email
    const { getAllTeams } = await import('@/lib/data/store');
    const allTeams = await getAllTeams();
    const userEmail = user.email?.toLowerCase();
    const matchedTeam = allTeams.find(
      (t) =>
        t.auth_id === user.id ||
        (userEmail && t.members.some((m) => m.email?.toLowerCase() === userEmail))
    );

    if (matchedTeam) {
      return {
        team: matchedTeam,
        members: matchedTeam.members,
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Returns the authenticated user.
 */
export async function requireAuth() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Require an authenticated user with a linked team.
 * Redirects to /login if not authenticated,
 * or /activate if no team is linked.
 */
export async function requireTeam(): Promise<{ team: Team; members: Member[] }> {
  const teamData = await getTeamForUser();
  if (teamData) {
    return teamData;
  }

  await requireAuth();
  redirect('/activate');
}

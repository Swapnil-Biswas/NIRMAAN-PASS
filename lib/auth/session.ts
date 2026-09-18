import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Team, Member } from '@/types/database';

/**
 * Get the current authenticated user, or null if not logged in.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/**
 * Get the team associated with the current authenticated user.
 * Returns null if not logged in or no team found.
 */
export async function getTeamForUser(): Promise<{ team: Team; members: Member[] } | null> {
  const user = await getSession();
  if (!user) return null;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (error || !team) return null;

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
  const user = await requireAuth();

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (error || !team) {
    redirect('/activate');
  }

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

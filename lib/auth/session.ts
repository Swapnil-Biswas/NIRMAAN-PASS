import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Team, Member } from '@/types/database';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

export const TEAM_COOKIE_NAME = 'nirmaan_team_session';
export const MAX_TEAM_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TeamSessionPayload {
  teamId: string;
  email: string;
  token: string;
  team_name: string;
  sid?: string;
  iat: number;
  exp: number;
}

function getTeamSigningSecret(): string {
  return (
    process.env.TEAM_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    'nirmaan_pass_participant_session_secret_2026'
  );
}

/**
 * Creates an HMAC-SHA256 signed, tamper-proof participant session token
 */
export function createTeamSessionToken(data: {
  teamId: string;
  email: string;
  token: string;
  team_name: string;
}): string {
  const now = Date.now();
  const payload: TeamSessionPayload = {
    teamId: data.teamId,
    email: data.email,
    token: data.token,
    team_name: data.team_name,
    sid: randomUUID(),
    iat: now,
    exp: now + MAX_TEAM_SESSION_LIFETIME_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getTeamSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  return `v1.${payloadB64}.${signature}`;
}

/**
 * Verifies and parses a signed participant session token
 */
export function verifyTeamSessionToken(token: string | undefined): TeamSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  // 1. Check if token is signed (v1.payload.signature)
  if (token.startsWith('v1.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [, payloadB64, signature] = parts;
    try {
      const expectedSignature = createHmac('sha256', getTeamSigningSecret())
        .update(payloadB64)
        .digest('base64url');

      const sigBuf = Buffer.from(signature);
      const expSigBuf = Buffer.from(expectedSignature);

      if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
        return null;
      }

      const payload: TeamSessionPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8')
      );

      const now = Date.now();
      if (now > payload.exp) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  // 2. Backward compatibility for legacy decoded or raw JSON strings during migration
  try {
    let raw = token;
    try {
      raw = decodeURIComponent(token);
    } catch {}
    const parsed = JSON.parse(raw);
    if (parsed && parsed.teamId && parsed.token) {
      return {
        teamId: parsed.teamId,
        email: parsed.email || '',
        token: parsed.token,
        team_name: parsed.team_name || '',
        iat: Date.now(),
        exp: Date.now() + MAX_TEAM_SESSION_LIFETIME_MS,
      };
    }
  } catch {}

  return null;
}

/**
 * Get the current authenticated user, or null if not logged in.
 * Supports both HMAC-signed standalone local team session cookie and Supabase Auth.
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();

    // 1. Check local team session cookie
    const localSession = cookieStore.get(TEAM_COOKIE_NAME)?.value;
    if (localSession) {
      const parsed = verifyTeamSessionToken(localSession);
      if (parsed) {
        return {
          id: parsed.teamId,
          email: parsed.email,
          user_metadata: {
            team_id: parsed.teamId,
            team_name: parsed.team_name,
            token: parsed.token,
          },
        } as any;
      }
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
    const localSession = cookieStore.get(TEAM_COOKIE_NAME)?.value;
    if (localSession) {
      const parsed = verifyTeamSessionToken(localSession);
      if (parsed) {
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
      }
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

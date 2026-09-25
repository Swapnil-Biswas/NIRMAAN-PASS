import {
  Team,
  Member,
  Announcement,
  ScheduleItem,
  ScanResult,
  EventStatistics,
  MealType,
  TeamReviewStatus,
  ScanEvent,
  ScanEventRecord,
} from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import { validateMealEligibility } from '@/lib/validation/rules';
import { generateQRToken } from '@/lib/qr/token';
import { normalizeEmail, normalizePhone, canonicalizeTeamName, type Track } from '@/lib/registration';
import { randomUUID } from 'crypto';

import fs from 'fs';
import path from 'path';

import seededDataset from './seeded_teams.json';

export const DEFAULT_SCHEDULE: ScheduleItem[] = [];

export interface NewTeamInput {
  teamName: string;
  college: string;
  track: Track;
  leader: { name: string; email: string; phone: string };
  members: { name: string; email: string; phone: string }[];
  reviewStatus?: TeamReviewStatus;
  duplicateNotes?: string | null;
  duplicateMatchTeamId?: string | null;
}

function loadInitialDiskData(): {
  teams: Team[];
  members: Member[];
  custom_events?: ScanEvent[];
  custom_records?: ScanEventRecord[];
} {
  try {
    const p = path.join(process.cwd(), 'lib', 'data', 'seeded_teams.json');
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.members)) {
        return parsed;
      }
    }
  } catch {}
  return seededDataset as {
    teams: Team[];
    members: Member[];
    custom_events?: ScanEvent[];
    custom_records?: ScanEventRecord[];
  };
}

const initialDataset = loadInitialDiskData();

// In-Memory store with NIRMAAN 2026 reference teams
interface MockDatabase {
  teams: Team[];
  members: Member[];
  announcements: Announcement[];
  schedule: ScheduleItem[];
  custom_events: ScanEvent[];
  custom_records: ScanEventRecord[];
}

const mockDb: MockDatabase = {
  teams: JSON.parse(JSON.stringify(initialDataset.teams)) as Team[],
  members: JSON.parse(JSON.stringify(initialDataset.members)) as Member[],
  announcements: [
    {
      id: 'ann-1',
      title: 'WELCOME TO NIRMAAN 2026',
      message: 'Welcome to NIRMAAN 2026 Hackathon at BMSIT. Ensure your team completes on-desk registration upon arrival.',
      priority: 'important',
      published: true,
      created_at: new Date().toISOString(),
    },
  ],
  schedule: JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)) as ScheduleItem[],
  custom_events: (initialDataset.custom_events ? JSON.parse(JSON.stringify(initialDataset.custom_events)) : []) as ScanEvent[],
  custom_records: (initialDataset.custom_records ? JSON.parse(JSON.stringify(initialDataset.custom_records)) : []) as ScanEventRecord[],
};

export function persistLocalDataset() {
  if (hasSupabaseConfig() || process.env.NODE_ENV === 'test') return;
  try {
    const p = path.join(process.cwd(), 'lib', 'data', 'seeded_teams.json');
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          teams: mockDb.teams,
          members: mockDb.members,
          custom_events: mockDb.custom_events,
          custom_records: mockDb.custom_records,
        },
        null,
        2
      )
    );
  } catch {}
}

// In-memory registration concurrency lock
let registrationMutex = Promise.resolve();

export async function createTeam(input: NewTeamInput): Promise<Team> {
  const unlock = await new Promise<() => void>((resolve) => {
    registrationMutex = registrationMutex.then(() => new Promise<void>((res) => resolve(res)));
  });

  try {
    const now = new Date().toISOString();
    const teamId = `team-${randomUUID()}`;
    const canonicalName = canonicalizeTeamName(input.teamName);
    const reviewStatus: TeamReviewStatus = input.reviewStatus || 'pending';

    const team: Team = {
      id: teamId,
      team_name: input.teamName,
      canonical_name: canonicalName,
      college: input.college,
      auth_id: null,
      qr_token: generateQRToken(),
      checked_in: false,
      breakfast_count: 0,
      lunch_count: 0,
      dinner_count: 0,
      coffee_count: 0,
      created_at: now,
      updated_at: now,
      track: input.track,
      review_status: reviewStatus,
      duplicate_notes: input.duplicateNotes || null,
      duplicate_match_team_id: input.duplicateMatchTeamId || null,
      merged_into_team_id: null,
    };

    const allMembers = [input.leader, ...input.members];
    const members: Member[] = allMembers.map((member, index) => ({
      id: `${teamId}-member-${index + 1}`,
      team_id: teamId,
      name: member.name,
      phone: member.phone,
      normalized_phone: normalizePhone(member.phone),
      email: member.email,
      normalized_email: normalizeEmail(member.email),
      present: false,
      created_at: now,
    }));

    if (hasSupabaseConfig()) {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      let created: any = null;
      let teamError: any = null;

      // Try inserting with all extended anti-duplicate fields
      const res1 = await supabase
        .from('teams')
        .insert({
          team_name: team.team_name,
          canonical_name: team.canonical_name,
          college: team.college,
          track: team.track,
          qr_token: team.qr_token,
          review_status: team.review_status,
          duplicate_notes: team.duplicate_notes,
          duplicate_match_team_id: team.duplicate_match_team_id,
        })
        .select('*')
        .single();

      if (res1.error && (res1.error.message.includes('column') || res1.error.message.includes('schema cache'))) {
        // Fall back to baseline columns with track
        const res2 = await supabase
          .from('teams')
          .insert({
            team_name: team.team_name,
            college: team.college,
            track: team.track,
            qr_token: team.qr_token,
          })
          .select('*')
          .single();

        if (res2.error && (res2.error.message.includes('column') || res2.error.message.includes('schema cache'))) {
          // Fall back to minimal original columns (without track)
          const res3 = await supabase
            .from('teams')
            .insert({
              team_name: team.team_name,
              college: team.college,
              qr_token: team.qr_token,
            })
            .select('*')
            .single();
          created = res3.data;
          teamError = res3.error;
        } else {
          created = res2.data;
          teamError = res2.error;
        }
      } else {
        created = res1.data;
        teamError = res1.error;
      }

      if (teamError || !created) {
        throw new Error(teamError?.message || 'Unable to create team in database.');
      }

      // Try inserting members with normalized fields
      const memRes1 = await supabase.from('members').insert(
        members.map(({ id, team_id, name, phone, email, normalized_phone, normalized_email }) => ({
          id,
          team_id: created.id,
          name,
          phone,
          normalized_phone,
          email,
          normalized_email,
        }))
      );

      if (memRes1.error && (memRes1.error.message.includes('column') || memRes1.error.message.includes('schema cache'))) {
        // Fall back to baseline member columns
        const memRes2 = await supabase.from('members').insert(
          members.map(({ id, team_id, name, phone, email }) => ({
            id,
            team_id: created.id,
            name,
            phone,
            email,
          }))
        );
        if (memRes2.error) {
          await supabase.from('teams').delete().eq('id', created.id);
          throw new Error(memRes2.error.message);
        }
      } else if (memRes1.error) {
        await supabase.from('teams').delete().eq('id', created.id);
        throw new Error(memRes1.error.message);
      }

      return {
        ...team,
        ...created,
      } as Team;
    }

    mockDb.teams.push(team);
    mockDb.members.push(...members);
    return team;
  } finally {
    unlock();
  }
}

function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Require service role key for write operations to bypass RLS
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder') && !key.includes('your-service'));
}

// -----------------------------------------------------------------------------
// High-Speed Server-Side Memory Cache Layer (0ms Read Latency)
// -----------------------------------------------------------------------------

type EnrichedTeam = Team & { members: Member[]; present_count: number; total_members: number };

interface StoreCache {
  teams: EnrichedTeam[] | null;
  teamsLastFetched: number;
  announcements: Announcement[] | null;
  announcementsLastFetched: number;
  schedule: ScheduleItem[] | null;
  scheduleLastFetched: number;
  events: ScanEvent[] | null;
  eventsLastFetched: number;
}

const CACHE_TTL_MS = 60000; // 60s TTL; invalidated instantly on any mutation

const storeCache: StoreCache = {
  teams: null,
  teamsLastFetched: 0,
  announcements: null,
  announcementsLastFetched: 0,
  schedule: null,
  scheduleLastFetched: 0,
  events: null,
  eventsLastFetched: 0,
};

export function invalidateTeamsCache() {
  storeCache.teams = null;
  storeCache.teamsLastFetched = 0;
}

export function invalidateAnnouncementsCache() {
  storeCache.announcements = null;
  storeCache.announcementsLastFetched = 0;
}

export function invalidateScheduleCache() {
  storeCache.schedule = null;
  storeCache.scheduleLastFetched = 0;
}

export function invalidateEventsCache() {
  storeCache.events = null;
  storeCache.eventsLastFetched = 0;
}

export function invalidateAllCache() {
  invalidateTeamsCache();
  invalidateAnnouncementsCache();
  invalidateScheduleCache();
  invalidateEventsCache();
}

// -----------------------------------------------------------------------------
// Data Access Operations (Direct Indexed Lookups)
// -----------------------------------------------------------------------------

export async function findTeamByToken(rawToken: string): Promise<Team | null> {
  const token = sanitizeQRToken(rawToken);
  if (!token) return null;

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .or(`qr_token.eq.${token},qr_token.eq.${rawToken.trim()}`)
        .maybeSingle();

      if (error) {
        console.error('[Supabase] findTeamByToken error:', error.message);
        return null;
      }
      return data as Team | null;
    } catch (e) {
      console.error('[Supabase] findTeamByToken exception:', e);
      return null;
    }
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  return team ? { ...team } : null;
}

export const findTeamByTokenDirect = findTeamByToken;

export async function findTeamByMemberEmail(email: string): Promise<{ team: Team; member: Member } | null> {
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = normalizeEmail(email);

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();

      const { data: member, error: memErr } = await supabase
        .from('members')
        .select('*')
        .or(`normalized_email.eq.${cleanEmail},email.ilike.${cleanEmail}`)
        .limit(1)
        .maybeSingle();

      if (memErr || !member) {
        return null;
      }

      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .select('*')
        .eq('id', member.team_id)
        .maybeSingle();

      if (teamErr || !team) {
        return null;
      }

      return {
        team: team as Team,
        member: member as Member,
      };
    } catch (e) {
      console.error('[Supabase] findTeamByMemberEmail exception:', e);
      return null;
    }
  }

  const matchedMember = mockDb.members.find(
    (m) =>
      (m.normalized_email && m.normalized_email === cleanEmail) ||
      (m.email && normalizeEmail(m.email) === cleanEmail)
  );
  if (!matchedMember) return null;

  const matchedTeam = mockDb.teams.find((t) => t.id === matchedMember.team_id);
  if (!matchedTeam) return null;

  return {
    team: { ...matchedTeam },
    member: { ...matchedMember },
  };
}

export async function findTeamById(teamId: string): Promise<Team | null> {
  if (!teamId) return null;

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();

      if (error) {
        console.error('[Supabase] findTeamById error:', error.message);
        return null;
      }
      return data as Team | null;
    } catch (e) {
      console.error('[Supabase] findTeamById exception:', e);
      return null;
    }
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  return team ? { ...team } : null;
}

export async function updateTeamAuthId(teamId: string, authId: string): Promise<boolean> {
  invalidateTeamsCache();

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('teams')
        .update({ auth_id: authId, updated_at: new Date().toISOString() })
        .eq('id', teamId);
      if (!error) return true;
    } catch {}
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  if (team) {
    team.auth_id = authId;
    team.updated_at = new Date().toISOString();
    persistLocalDataset();
    return true;
  }
  return false;
}

export async function getTeamMembers(teamId: string): Promise<Member[]> {
  if (!teamId) return [];

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Supabase] getTeamMembers error:', error.message);
        return [];
      }
      return (data || []) as Member[];
    } catch (e) {
      console.error('[Supabase] getTeamMembers exception:', e);
      return [];
    }
  }

  return mockDb.members.filter((m) => m.team_id === teamId).map((m) => ({ ...m }));
}

export async function getAllTeams(): Promise<EnrichedTeam[]> {
  const now = Date.now();
  if (storeCache.teams && now - storeCache.teamsLastFetched < CACHE_TTL_MS) {
    return storeCache.teams;
  }

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const [teamsRes, membersRes] = await Promise.all([
        supabase.from('teams').select('*').order('created_at', { ascending: true }),
        supabase.from('members').select('*').order('created_at', { ascending: true }),
      ]);
      const teams = teamsRes.data;
      const members = membersRes.data;
      const teamsError = teamsRes.error;

      if (!teamsError && Array.isArray(teams)) {
        const enrichedTeams: EnrichedTeam[] = teams
          .map((team: Team) => {
            const teamMembers = (members || []).filter((m: Member) => m.team_id === team.id);
            const present = teamMembers.filter((m: Member) => m.present).length;
            return {
              ...team,
              members: teamMembers,
              present_count: present,
              total_members: teamMembers.length,
            };
          })
          .sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' }));

        storeCache.teams = enrichedTeams;
        storeCache.teamsLastFetched = now;
        return enrichedTeams;
      }
    } catch {
      // Fallback
    }
  }

  if (mockDb.teams.length === 0 && seededDataset.teams && seededDataset.teams.length > 0) {
    mockDb.teams = JSON.parse(JSON.stringify(seededDataset.teams)) as Team[];
    mockDb.members = JSON.parse(JSON.stringify(seededDataset.members)) as Member[];
  }

  const enrichedTeams: EnrichedTeam[] = mockDb.teams
    .map((team) => {
      const teamMembers = mockDb.members.filter((m) => m.team_id === team.id);
      const present = teamMembers.filter((m) => m.present).length;
      return {
        ...team,
        members: teamMembers,
        present_count: present,
        total_members: teamMembers.length,
      };
    })
    .sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' }));

  storeCache.teams = enrichedTeams;
  storeCache.teamsLastFetched = now;
  return enrichedTeams;
}

// -----------------------------------------------------------------------------
// Live Scan Operations (Atomic Server Execution)
// -----------------------------------------------------------------------------

export async function processMealScan(rawToken: string, mealType: MealType): Promise<ScanResult> {
  invalidateTeamsCache();
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_meal_scan', {
        p_qr_token: token,
        p_meal_type: mealType,
      });

      if (error) {
        console.error('[Supabase] process_meal_scan error:', error.message, error.code, error.details);
        return {
          success: false,
          error_code: 'SERVER_ERROR',
          message: `Database error: ${error.message}`,
        };
      }
      if (data) return data as ScanResult;
    } catch (e: any) {
      console.error('[Supabase] process_meal_scan exception:', e);
      return {
        success: false,
        error_code: 'SERVER_ERROR',
        message: e?.message || 'Database error during meal scan.',
      };
    }
    return {
      success: false,
      error_code: 'SERVER_ERROR',
      message: 'Failed to complete meal scan in database.',
    };
  }

  // Fallback in-memory atomic processing
  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return {
      success: false,
      error_code: 'INVALID_QR',
      message: 'Invalid QR — Team not found.',
    };
  }

  if (team.review_status === 'rejected') {
    return {
      success: false,
      error_code: 'TOKEN_REVOKED',
      message: 'This event pass has been rejected or disqualified by organizers.',
    };
  }

  if (team.review_status === 'merged') {
    return {
      success: false,
      error_code: 'TEAM_MERGED',
      message: 'This duplicate team pass was merged into another registration and is now inactive.',
    };
  }

  const members = mockDb.members.filter((m) => m.team_id === team.id);
  const validation = validateMealEligibility(team, members, mealType);

  if (!validation.eligible) {
    return {
      success: false,
      error_code: validation.errorCode,
      message: validation.message,
      team_id: team.id,
      team_name: team.team_name,
      college: team.college,
      checked_in: team.checked_in,
      present_count: validation.presentCount,
      current_count: validation.currentCount,
      meal_type: mealType,
    };
  }

  // Increment atomically
  if (mealType === 'breakfast') team.breakfast_count += 1;
  if (mealType === 'lunch') team.lunch_count += 1;
  if (mealType === 'dinner') team.dinner_count += 1;
  team.updated_at = new Date().toISOString();
  persistLocalDataset();

  const newCount =
    mealType === 'breakfast'
      ? team.breakfast_count
      : mealType === 'lunch'
      ? team.lunch_count
      : team.dinner_count;

  return {
    success: true,
    team_id: team.id,
    team_name: team.team_name,
    college: team.college,
    meal_type: mealType,
    present_count: validation.presentCount,
    new_count: newCount,
    remaining_count: validation.presentCount - newCount,
    message: `Successfully served ${mealType} (${newCount}/${validation.presentCount})`,
  };
}

export const TOTAL_COFFEE_CAP = 900;

export async function processCoffeeScan(rawToken: string): Promise<ScanResult> {
  invalidateTeamsCache();
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_coffee_scan', {
        p_qr_token: token,
      });

      if (error) {
        console.error('[Supabase] process_coffee_scan error:', error.message, error.code, error.details);
        return {
          success: false,
          error_code: 'SERVER_ERROR',
          message: `Database error: ${error.message}`,
        };
      }
      if (data) return data as ScanResult;
    } catch (e: any) {
      console.error('[Supabase] process_coffee_scan exception:', e);
      return {
        success: false,
        error_code: 'SERVER_ERROR',
        message: e?.message || 'Database error during coffee scan.',
      };
    }
    return {
      success: false,
      error_code: 'SERVER_ERROR',
      message: 'Failed to complete coffee scan in database.',
    };
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return {
      success: false,
      error_code: 'INVALID_QR',
      message: 'Invalid QR — Team not found.',
    };
  }

  if (team.review_status === 'rejected') {
    return {
      success: false,
      error_code: 'TOKEN_REVOKED',
      message: 'This event pass has been rejected or disqualified by organizers.',
    };
  }

  if (team.review_status === 'merged') {
    return {
      success: false,
      error_code: 'TEAM_MERGED',
      message: 'This duplicate team pass was merged into another registration and is now inactive.',
    };
  }

  // Enforce total 900 cups cap across all teams
  const activeTeams = mockDb.teams.filter((t) => t.review_status !== 'rejected' && t.review_status !== 'merged');
  const totalCoffeeServed = activeTeams.reduce((acc, t) => acc + (t.coffee_count || 0), 0);
  if (totalCoffeeServed >= TOTAL_COFFEE_CAP) {
    return {
      success: false,
      error_code: 'LIMIT_REACHED',
      message: `Coffee limit reached! Maximum ${TOTAL_COFFEE_CAP} cups allocated for NIRMAAN 2026 have already been served.`,
    };
  }

  team.coffee_count += 1;
  team.updated_at = new Date().toISOString();
  persistLocalDataset();

  return {
    success: true,
    team_id: team.id,
    team_name: team.team_name,
    college: team.college,
    new_count: team.coffee_count,
    message: `Coffee/Tea served to ${team.team_name} (Total: ${team.coffee_count} cups)`,
  };
}

export async function processRegistration(rawToken: string, presentMemberIds: string[]): Promise<ScanResult> {
  invalidateTeamsCache();
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_registration', {
        p_qr_token: token,
        p_present_member_ids: presentMemberIds,
      });

      if (error) {
        console.error('[Supabase] process_registration error:', error.message, error.code, error.details);
        return {
          success: false,
          error_code: 'SERVER_ERROR',
          message: `Database error: ${error.message}`,
        };
      }
      if (data) return data as ScanResult;
    } catch (e: any) {
      console.error('[Supabase] process_registration exception:', e);
      return {
        success: false,
        error_code: 'SERVER_ERROR',
        message: e?.message || 'Database error during registration scan.',
      };
    }
    return {
      success: false,
      error_code: 'SERVER_ERROR',
      message: 'Failed to complete registration scan in database.',
    };
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return {
      success: false,
      error_code: 'INVALID_QR',
      message: 'Invalid QR — Team not found.',
    };
  }

  if (team.review_status === 'rejected') {
    return {
      success: false,
      error_code: 'TOKEN_REVOKED',
      message: 'This event pass has been rejected or disqualified by organizers.',
    };
  }

  if (team.review_status === 'merged') {
    return {
      success: false,
      error_code: 'TEAM_MERGED',
      message: 'This duplicate team pass was merged into another registration and is now inactive.',
    };
  }

  team.checked_in = true;
  team.updated_at = new Date().toISOString();

  // Update members present status
  const teamMembers = mockDb.members.filter((m) => m.team_id === team.id);
  teamMembers.forEach((member) => {
    member.present = presentMemberIds.includes(member.id);
  });
  persistLocalDataset();

  const presentCount = teamMembers.filter((m) => m.present).length;

  return {
    success: true,
    team_id: team.id,
    team_name: team.team_name,
    college: team.college,
    checked_in: true,
    total_members: teamMembers.length,
    present_count: presentCount,
    members: teamMembers,
    message: `Registration saved. ${presentCount}/${teamMembers.length} members marked present.`,
  };
}

export async function updateTeamReviewStatus(
  teamId: string,
  reviewStatus: TeamReviewStatus,
  notes?: string
): Promise<Team | null> {
  invalidateTeamsCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const updates: Record<string, any> = { review_status: reviewStatus, updated_at: new Date().toISOString() };
      if (notes !== undefined) updates.duplicate_notes = notes;
      const { data, error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();
      if (!error && data) return data as Team;
    } catch (e) {
      console.error('[Supabase] updateTeamReviewStatus error:', e);
    }
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  if (!team) return null;
  team.review_status = reviewStatus;
  if (notes !== undefined) team.duplicate_notes = notes;
  team.updated_at = new Date().toISOString();
  return { ...team };
}

export async function mergeDuplicateTeam(
  duplicateTeamId: string,
  primaryTeamId: string,
  notes?: string
): Promise<{ success: boolean; message: string; primaryTeam?: Team; duplicateTeam?: Team }> {
  invalidateTeamsCache();
  if (duplicateTeamId === primaryTeamId) {
    return { success: false, message: 'Cannot merge a team into itself.' };
  }

  const primaryTeam = await findTeamById(primaryTeamId);
  const duplicateTeam = await findTeamById(duplicateTeamId);

  if (!primaryTeam || !duplicateTeam) {
    return { success: false, message: 'Primary or duplicate team not found.' };
  }

  const mergeNote = notes || `Merged duplicate registration into primary team '${primaryTeam.team_name}' (${primaryTeam.id})`;

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('teams')
        .update({
          review_status: 'merged',
          merged_into_team_id: primaryTeamId,
          duplicate_notes: mergeNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', duplicateTeamId)
        .select()
        .single();
      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: `Successfully merged duplicate team '${duplicateTeam.team_name}' into '${primaryTeam.team_name}'.`,
        primaryTeam,
        duplicateTeam: data as Team,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error merging teams.' };
    }
  }

  const dup = mockDb.teams.find((t) => t.id === duplicateTeamId);
  if (dup) {
    dup.review_status = 'merged';
    dup.merged_into_team_id = primaryTeamId;
    dup.duplicate_notes = mergeNote;
    dup.updated_at = new Date().toISOString();
  }

  return {
    success: true,
    message: `Successfully merged duplicate team '${duplicateTeam.team_name}' into '${primaryTeam.team_name}'.`,
    primaryTeam,
    duplicateTeam: dup ? { ...dup } : duplicateTeam,
  };
}

export interface UpdateTeamDetailsInput {
  teamName: string;
  college: string;
  track: Track;
  leader: { name: string; email: string; phone: string };
  members: { name: string; email?: string; phone: string }[];
}

export async function updateTeamDetails(
  teamId: string,
  input: UpdateTeamDetailsInput
): Promise<{ success: boolean; message: string; team?: Team; members?: Member[] }> {
  invalidateTeamsCache();
  const canonicalName = canonicalizeTeamName(input.teamName);
  const now = new Date().toISOString();
  const allMembersInput = [input.leader, ...input.members];

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();

      let updatedTeam: any = null;
      let teamError: any = null;

      const res1 = await supabase
        .from('teams')
        .update({
          team_name: input.teamName,
          canonical_name: canonicalName,
          college: input.college,
          track: input.track,
          updated_at: now,
        })
        .eq('id', teamId)
        .select()
        .single();

      if (res1.error && (res1.error.message.includes('column') || res1.error.message.includes('schema cache'))) {
        const res2 = await supabase
          .from('teams')
          .update({
            team_name: input.teamName,
            college: input.college,
            track: input.track,
            updated_at: now,
          })
          .eq('id', teamId)
          .select()
          .single();

        if (res2.error && (res2.error.message.includes('column') || res2.error.message.includes('schema cache'))) {
          const res3 = await supabase
            .from('teams')
            .update({
              team_name: input.teamName,
              college: input.college,
              updated_at: now,
            })
            .eq('id', teamId)
            .select()
            .single();
          updatedTeam = res3.data;
          teamError = res3.error;
        } else {
          updatedTeam = res2.data;
          teamError = res2.error;
        }
      } else {
        updatedTeam = res1.data;
        teamError = res1.error;
      }

      if (teamError || !updatedTeam) {
        return { success: false, message: teamError?.message || 'Failed to update team.' };
      }

      const { data: existingMembers } = await supabase
        .from('members')
        .select('*')
        .eq('team_id', teamId);

      const existingPresentPhones = new Set(
        (existingMembers || []).filter((m: Member) => m.present).map((m: Member) => normalizePhone(m.phone))
      );

      await supabase.from('members').delete().eq('team_id', teamId);

      const newMembers = allMembersInput.map((member, index) => ({
        id: `${teamId}-member-${index + 1}-${Date.now()}`,
        team_id: teamId,
        name: member.name.trim(),
        phone: member.phone.trim(),
        normalized_phone: normalizePhone(member.phone),
        email: member.email ? normalizeEmail(member.email) : '',
        normalized_email: member.email ? normalizeEmail(member.email) : '',
        present: existingPresentPhones.has(normalizePhone(member.phone)),
        is_leader: index === 0,
        created_at: now,
      }));

      let insertedMembers: any = null;
      const memRes1 = await supabase
        .from('members')
        .insert(newMembers)
        .select('*');

      if (memRes1.error && (memRes1.error.message.includes('column') || memRes1.error.message.includes('schema cache'))) {
        const memRes2 = await supabase
          .from('members')
          .insert(
            newMembers.map(({ id, team_id, name, phone, email, present, created_at }) => ({
              id,
              team_id,
              name,
              phone,
              email,
              present,
              created_at,
            }))
          )
          .select('*');
        if (memRes2.error) {
          return { success: false, message: memRes2.error.message };
        }
        insertedMembers = memRes2.data;
      } else if (memRes1.error) {
        return { success: false, message: memRes1.error.message };
      } else {
        insertedMembers = memRes1.data;
      }

      return {
        success: true,
        message: 'Team details updated successfully.',
        team: updatedTeam as Team,
        members: (insertedMembers || []) as Member[],
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error updating team' };
    }
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  if (!team) {
    return { success: false, message: 'Team not found' };
  }

  team.team_name = input.teamName;
  team.canonical_name = canonicalName;
  team.college = input.college;
  team.track = input.track;
  team.updated_at = now;

  const existingMembers = mockDb.members.filter((m) => m.team_id === teamId);
  const existingPresentPhones = new Set(
    existingMembers.filter((m) => m.present).map((m: Member) => normalizePhone(m.phone))
  );

  mockDb.members = mockDb.members.filter((m) => m.team_id !== teamId);

  const updatedMembers: Member[] = allMembersInput.map((member, index) => ({
    id: `${teamId}-member-${index + 1}-${Date.now()}`,
    team_id: teamId,
    name: member.name.trim(),
    phone: member.phone.trim(),
    normalized_phone: normalizePhone(member.phone),
    email: member.email ? normalizeEmail(member.email) : '',
    normalized_email: member.email ? normalizeEmail(member.email) : '',
    present: existingPresentPhones.has(normalizePhone(member.phone)),
    is_leader: index === 0,
    created_at: now,
  }));

  mockDb.members.push(...updatedMembers);

  return {
    success: true,
    message: 'Team details updated successfully.',
    team: { ...team },
    members: updatedMembers.map((m) => ({ ...m })),
  };
}

export async function deleteTeam(teamId: string): Promise<boolean> {
  invalidateTeamsCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('members').delete().eq('team_id', teamId);
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) {
        console.error('[Supabase] deleteTeam error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Supabase] deleteTeam exception:', e);
      return false;
    }
  }

  mockDb.members = mockDb.members.filter((m) => m.team_id !== teamId);
  mockDb.teams = mockDb.teams.filter((t) => t.id !== teamId);
  return true;
}

export async function deleteAllTeams(): Promise<boolean> {
  invalidateTeamsCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('members').delete().neq('id', 'placeholder');
      const { error } = await supabase.from('teams').delete().neq('id', 'placeholder');
      if (error) {
        console.error('[Supabase] deleteAllTeams error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Supabase] deleteAllTeams exception:', e);
      return false;
    }
  }

  mockDb.members = [];
  mockDb.teams = [];
  return true;
}

export async function restoreDefaultTeams(): Promise<{ success: boolean; count: number; message: string }> {
  invalidateTeamsCache();
  const datasetTeams = JSON.parse(JSON.stringify(seededDataset.teams)) as Team[];
  const datasetMembers = JSON.parse(JSON.stringify(seededDataset.members)) as Member[];

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();

      const teamsPayload = datasetTeams.map((t) => ({
        id: t.id,
        team_name: t.team_name,
        canonical_name: t.canonical_name || null,
        college: t.college,
        track: t.track || 'Open Innovation',
        qr_token: t.qr_token,
        checked_in: false,
        breakfast_count: 0,
        lunch_count: 0,
        dinner_count: 0,
        coffee_count: 0,
        review_status: t.review_status || 'approved',
        duplicate_notes: t.duplicate_notes || null,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
      }));

      await supabase.from('teams').upsert(teamsPayload, { onConflict: 'id' });

      const membersPayload = datasetMembers.map((m) => ({
        id: m.id,
        team_id: m.team_id,
        name: m.name,
        email: m.email || '',
        phone: m.phone || '',
        normalized_phone: m.normalized_phone || '',
        normalized_email: m.normalized_email || '',
        present: false,
      }));

      await supabase.from('members').upsert(membersPayload, { onConflict: 'id' });
    } catch (e: any) {
      console.error('[Supabase] restoreDefaultTeams error:', e);
    }
  }

  mockDb.teams = datasetTeams;
  mockDb.members = datasetMembers;
  persistLocalDataset();

  return {
    success: true,
    count: datasetTeams.length,
    message: `Successfully restored all ${datasetTeams.length} official NIRMAAN 2026 teams.`,
  };
}

export async function resetAllScansAndAttendance(): Promise<{ success: boolean; message: string }> {
  invalidateAllCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await Promise.all([
        supabase
          .from('teams')
          .update({
            checked_in: false,
            breakfast_count: 0,
            lunch_count: 0,
            dinner_count: 0,
            coffee_count: 0,
            updated_at: new Date().toISOString(),
          })
          .neq('id', 'placeholder'),
        supabase
          .from('members')
          .update({ present: false })
          .neq('id', 'placeholder'),
        supabase
          .from('custom_scan_records')
          .delete()
          .neq('id', 'placeholder'),
      ]);
    } catch (e: any) {
      console.error('[Supabase] resetAllScansAndAttendance exception:', e);
    }
  }

  // Reset in-memory database
  mockDb.teams.forEach((t) => {
    t.checked_in = false;
    t.breakfast_count = 0;
    t.lunch_count = 0;
    t.dinner_count = 0;
    t.coffee_count = 0;
    t.updated_at = new Date().toISOString();
  });

  mockDb.members.forEach((m) => {
    m.present = false;
  });

  mockDb.custom_records = [];
  persistLocalDataset();

  return {
    success: true,
    message: 'All team check-in statuses, member attendance, and meal/coffee/custom scan counts have been reset to 0.',
  };
}

export async function resetTeamAttendance(teamId: string): Promise<boolean> {
  invalidateAllCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await Promise.all([
        supabase
          .from('teams')
          .update({
            checked_in: false,
            breakfast_count: 0,
            lunch_count: 0,
            dinner_count: 0,
            coffee_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', teamId),
        supabase
          .from('members')
          .update({ present: false })
          .eq('team_id', teamId),
        supabase
          .from('custom_scan_records')
          .delete()
          .eq('team_id', teamId),
      ]);
    } catch {}
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  if (team) {
    team.checked_in = false;
    team.breakfast_count = 0;
    team.lunch_count = 0;
    team.dinner_count = 0;
    team.coffee_count = 0;
    team.updated_at = new Date().toISOString();
  }

  mockDb.members
    .filter((m) => m.team_id === teamId)
    .forEach((m) => {
      m.present = false;
    });

  mockDb.custom_records = mockDb.custom_records.filter((r) => r.team_id !== teamId);
  persistLocalDataset();

  return true;
}

export async function getEventStatistics(): Promise<EventStatistics> {
  const allTeams = await getAllTeams();

  const activeTeams = allTeams.filter((t) => t.review_status !== 'rejected' && t.review_status !== 'merged');
  const totalTeams = activeTeams.length;
  const checkedInTeams = activeTeams.filter((t) => t.checked_in).length;
  const totalStudents = activeTeams.reduce((acc, t) => acc + (t.total_members || 0), 0);
  const presentStudents = activeTeams.reduce((acc, t) => acc + (t.present_count || 0), 0);
  const breakfastServed = activeTeams.reduce((acc, t) => acc + (t.breakfast_count || 0), 0);
  const lunchServed = activeTeams.reduce((acc, t) => acc + (t.lunch_count || 0), 0);
  const dinnerServed = activeTeams.reduce((acc, t) => acc + (t.dinner_count || 0), 0);
  const totalCoffee = activeTeams.reduce((acc, t) => acc + (t.coffee_count || 0), 0);

  return {
    total_teams: totalTeams,
    checked_in_teams: checkedInTeams,
    total_students: totalStudents,
    present_students: presentStudents,
    breakfast_served: breakfastServed,
    lunch_served: lunchServed,
    dinner_served: dinnerServed,
    total_coffee: totalCoffee,
  };
}

export async function getAnnouncements(onlyPublished = true): Promise<Announcement[]> {
  const now = Date.now();
  if (storeCache.announcements && now - storeCache.announcementsLastFetched < CACHE_TTL_MS) {
    return onlyPublished
      ? storeCache.announcements.filter((a) => a.published)
      : storeCache.announcements;
  }

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (onlyPublished) query = query.eq('published', true);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        storeCache.announcements = data as Announcement[];
        storeCache.announcementsLastFetched = now;
        return onlyPublished ? (data as Announcement[]).filter((a) => a.published) : (data as Announcement[]);
      }
    } catch {
      // Fallback
    }
  }

  let list = mockDb.announcements;
  if (onlyPublished) {
    list = list.filter((a) => a.published);
  }
  const sorted = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  storeCache.announcements = sorted;
  storeCache.announcementsLastFetched = now;
  return sorted;
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id' | 'created_at'>): Promise<Announcement> {
  invalidateAnnouncementsCache();

  const newAnn: Announcement = {
    id: `ann-${Date.now()}`,
    ...announcement,
    created_at: new Date().toISOString(),
  };

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('announcements').insert(newAnn).select().single();
      if (!error && data) return data as Announcement;
    } catch {
      // Fallback
    }
  }

  mockDb.announcements.unshift(newAnn);
  return newAnn;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  invalidateAnnouncementsCache();

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (!error) return true;
    } catch {
      // Fallback to local store
    }
  }

  const idx = mockDb.announcements.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  mockDb.announcements.splice(idx, 1);
  return true;
}

// -----------------------------------------------------------------------------
// Schedule Management
// -----------------------------------------------------------------------------

export async function getSchedule(): Promise<ScheduleItem[]> {
  const now = Date.now();
  if (storeCache.schedule && now - storeCache.scheduleLastFetched < CACHE_TTL_MS) {
    return storeCache.schedule;
  }

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .order('order_index', { ascending: true });
      if (!error && data && data.length > 0) {
        storeCache.schedule = data as ScheduleItem[];
        storeCache.scheduleLastFetched = now;
        return data as ScheduleItem[];
      }
    } catch {
      // Fallback to local store
    }
  }

  const sorted = [...mockDb.schedule].sort((a, b) => a.order_index - b.order_index);
  storeCache.schedule = sorted;
  storeCache.scheduleLastFetched = now;
  return sorted;
}

export async function createScheduleItem(
  item: Omit<ScheduleItem, 'id' | 'created_at' | 'order_index'> & { order_index?: number }
): Promise<ScheduleItem> {
  invalidateScheduleCache();

  const newId = `sch-${Date.now()}`;
  const maxOrder = mockDb.schedule.reduce((max, s) => Math.max(max, s.order_index), 0);
  const newItem: ScheduleItem = {
    id: newId,
    time: item.time.trim(),
    title: item.title.trim().toUpperCase(),
    tag: item.tag.trim().toUpperCase(),
    color: item.color || 'bg-nirmaan-blue',
    text_color: item.text_color || (item.color?.includes('amber') || item.color?.includes('green-bright') ? 'text-nirmaan-black' : 'text-white'),
    order_index: item.order_index ?? maxOrder + 1,
    created_at: new Date().toISOString(),
  };

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('schedule').insert(newItem).select().single();
      if (!error && data) return data as ScheduleItem;
    } catch {
      // Fallback to local store
    }
  }

  mockDb.schedule.push(newItem);
  mockDb.schedule.sort((a, b) => a.order_index - b.order_index);
  return newItem;
}

export async function updateScheduleItem(
  id: string,
  updates: Partial<ScheduleItem>
): Promise<ScheduleItem | null> {
  invalidateScheduleCache();

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('schedule')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as ScheduleItem;
    } catch {
      // Fallback
    }
  }

  const idx = mockDb.schedule.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  mockDb.schedule[idx] = {
    ...mockDb.schedule[idx],
    ...updates,
    ...(updates.title ? { title: updates.title.trim().toUpperCase() } : {}),
    ...(updates.tag ? { tag: updates.tag.trim().toUpperCase() } : {}),
    ...(updates.time ? { time: updates.time.trim() } : {}),
  };
  mockDb.schedule.sort((a, b) => a.order_index - b.order_index);
  return mockDb.schedule[idx];
}

export async function deleteScheduleItem(id: string): Promise<boolean> {
  invalidateScheduleCache();

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { error } = await supabase.from('schedule').delete().eq('id', id);
      if (!error) return true;
    } catch {
      // Fallback
    }
  }

  const initialLength = mockDb.schedule.length;
  mockDb.schedule = mockDb.schedule.filter((s) => s.id !== id);
  return mockDb.schedule.length < initialLength;
}

export async function reorderSchedule(orderList: { id: string; order_index: number }[]): Promise<boolean> {
  invalidateScheduleCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      for (const item of orderList) {
        await supabase.from('schedule').update({ order_index: item.order_index }).eq('id', item.id);
      }
      return true;
    } catch {
      // Fallback
    }
  }

  orderList.forEach(({ id, order_index }) => {
    const item = mockDb.schedule.find((s) => s.id === id);
    if (item) {
      item.order_index = order_index;
    }
  });
  mockDb.schedule.sort((a, b) => a.order_index - b.order_index);
  return true;
}

export async function resetSchedule(): Promise<ScheduleItem[]> {
  invalidateScheduleCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('schedule').delete().neq('id', 'placeholder');
      if (DEFAULT_SCHEDULE.length > 0) {
        await supabase.from('schedule').insert(DEFAULT_SCHEDULE);
      }
    } catch {
      // Fallback
    }
  }

  mockDb.schedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  return [...mockDb.schedule];
}

// -----------------------------------------------------------------------------
// Dynamic Custom Scan Events & Records
// -----------------------------------------------------------------------------

export async function getCustomScanEvents(): Promise<ScanEvent[]> {
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('custom_scan_events')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data as ScanEvent[];
      }
    } catch {
      // Fallback
    }
  }

  return [...mockDb.custom_events];
}

export async function createCustomScanEvent(
  input: Omit<ScanEvent, 'id' | 'created_at' | 'active' | 'color'> & {
    active?: boolean;
    color?: string;
  }
): Promise<ScanEvent> {
  const id = `evt-${randomUUID()}`;
  const now = new Date().toISOString();
  const newEvent: ScanEvent = {
    id,
    title: input.title.trim().toUpperCase(),
    description: input.description?.trim() || null,
    limit_rule: input.limit_rule || 'per_present_member',
    color: input.color || 'bg-nirmaan-amber',
    text_color: input.text_color || (input.color?.includes('blue') || input.color?.includes('purple') || input.color?.includes('dark') || input.color?.includes('red') ? 'text-white' : 'text-nirmaan-black'),
    icon: input.icon || 'Sparkles',
    active: input.active !== undefined ? input.active : true,
    order_index: input.order_index || 0,
    created_at: now,
  };

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('custom_scan_events')
        .insert(newEvent)
        .select()
        .single();

      if (!error && data) {
        return data as ScanEvent;
      }
    } catch {
      // Fallback
    }
  }

  mockDb.custom_events.push(newEvent);
  invalidateEventsCache();
  persistLocalDataset();
  return newEvent;
}

export async function deleteCustomScanEvent(id: string): Promise<boolean> {
  invalidateEventsCache();
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('custom_scan_records').delete().eq('event_id', id);
      const { error } = await supabase.from('custom_scan_events').delete().eq('id', id);
      if (!error) return true;
    } catch {
      // Fallback
    }
  }

  mockDb.custom_records = mockDb.custom_records.filter((r) => r.event_id !== id);
  const initialCount = mockDb.custom_events.length;
  mockDb.custom_events = mockDb.custom_events.filter((e) => e.id !== id);
  persistLocalDataset();
  return mockDb.custom_events.length < initialCount;
}

export async function getCustomScanRecords(eventId?: string, teamId?: string): Promise<ScanEventRecord[]> {
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      let query = supabase.from('custom_scan_records').select('*');
      if (eventId) query = query.eq('event_id', eventId);
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data as ScanEventRecord[];
      }
    } catch {
      // Fallback
    }
  }

  return mockDb.custom_records.filter((r) => {
    if (eventId && r.event_id !== eventId) return false;
    if (teamId && r.team_id !== teamId) return false;
    return true;
  });
}

export async function processCustomScan(
  rawToken: string,
  eventId: string,
  requestedCount = 1,
  presentMemberIds?: string[]
): Promise<ScanResult> {
  invalidateTeamsCache();
  const token = sanitizeQRToken(rawToken);
  if (!token) {
    return { success: false, error_code: 'INVALID_QR', message: 'Invalid QR token provided' };
  }

  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_custom_scan', {
        p_qr_token: token,
        p_event_id: eventId,
        p_count: requestedCount,
        p_present_member_ids: presentMemberIds || null,
      });

      if (error) {
        console.error('[Supabase] process_custom_scan error:', error.message, error.code, error.details);
        return {
          success: false,
          error_code: 'SERVER_ERROR',
          message: `Database error: ${error.message}`,
        };
      }
      if (data) return data as ScanResult;
    } catch (e: any) {
      console.error('[Supabase] process_custom_scan exception:', e);
      return {
        success: false,
        error_code: 'SERVER_ERROR',
        message: e?.message || 'Database error during custom scan.',
      };
    }
    return {
      success: false,
      error_code: 'SERVER_ERROR',
      message: 'Failed to complete custom scan in database.',
    };
  }

  const event = mockDb.custom_events.find((e) => e.id === eventId && e.active);
  if (!event) {
    return { success: false, error_code: 'INVALID_EVENT', message: 'Scan event not found or inactive' };
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return { success: false, error_code: 'INVALID_QR', message: 'Invalid QR — Team not registered in system' };
  }

  if (team.review_status === 'rejected') {
    return { success: false, error_code: 'TEAM_REJECTED', message: 'Team registration was rejected by organizers' };
  }

  if (team.review_status === 'merged') {
    return { success: false, error_code: 'TEAM_MERGED', message: 'Team registration was merged into another primary team' };
  }

  const members = mockDb.members.filter((m) => m.team_id === team.id);
  const presentCount = members.filter((m) => m.present).length;

  // 1. Rule: Once per team check-in
  if (event.limit_rule === 'once_per_team') {
    const existingRecords = mockDb.custom_records.filter(
      (r) => r.event_id === eventId && r.team_id === team.id
    );
    if (existingRecords.length > 0) {
      return {
        success: false,
        error_code: 'ALREADY_COMPLETED',
        message: `Team "${team.team_name}" has already checked in for ${event.title}.`,
        team_id: team.id,
        team_name: team.team_name,
        college: team.college,
        checked_in: team.checked_in,
        event_id: event.id,
        event_title: event.title,
        current_count: existingRecords.reduce((acc, r) => acc + r.count, 0),
      };
    }

    const record: ScanEventRecord = {
      id: `rec-${randomUUID()}`,
      event_id: eventId,
      team_id: team.id,
      count: 1,
      present_member_ids: presentMemberIds || null,
      scanned_at: new Date().toISOString(),
    };

    mockDb.custom_records.push(record);
    persistLocalDataset();

    return {
      success: true,
      message: `Check-in recorded for "${team.team_name}" for ${event.title}!`,
      team_id: team.id,
      team_name: team.team_name,
      college: team.college,
      checked_in: team.checked_in,
      event_id: event.id,
      event_title: event.title,
      current_count: 1,
      new_count: 1,
      remaining_count: 0,
      present_count: presentCount,
      total_members: members.length,
      members,
    };
  }

  // 2. Rule: Per present member entitlement
  if (event.limit_rule === 'per_present_member') {
    if (!team.checked_in) {
      return {
        success: false,
        error_code: 'NOT_CHECKED_IN',
        message: 'Team must complete on-desk registration check-in first.',
        team_id: team.id,
        team_name: team.team_name,
        college: team.college,
        checked_in: false,
      };
    }

    if (presentCount === 0) {
      return {
        success: false,
        error_code: 'NO_PRESENT_MEMBERS',
        message: 'No members are marked present for this team.',
        team_id: team.id,
        team_name: team.team_name,
        checked_in: true,
        present_count: 0,
      };
    }

    const existingRecords = mockDb.custom_records.filter(
      (r) => r.event_id === eventId && r.team_id === team.id
    );
    const currentCount = existingRecords.reduce((acc, r) => acc + r.count, 0);
    const remaining = Math.max(0, presentCount - currentCount);

    if (currentCount + requestedCount > presentCount) {
      return {
        success: false,
        error_code: 'LIMIT_REACHED',
        message: `Limit reached for ${event.title}: ${currentCount}/${presentCount} already recorded.`,
        team_id: team.id,
        team_name: team.team_name,
        college: team.college,
        checked_in: true,
        event_id: event.id,
        event_title: event.title,
        present_count: presentCount,
        current_count: currentCount,
        remaining_count: remaining,
      };
    }

    const newCount = currentCount + requestedCount;
    const record: ScanEventRecord = {
      id: `rec-${randomUUID()}`,
      event_id: eventId,
      team_id: team.id,
      count: requestedCount,
      present_member_ids: presentMemberIds || null,
      scanned_at: new Date().toISOString(),
    };

    mockDb.custom_records.push(record);
    persistLocalDataset();

    return {
      success: true,
      message: `Recorded ${requestedCount} for "${team.team_name}" (${newCount}/${presentCount} for ${event.title})`,
      team_id: team.id,
      team_name: team.team_name,
      college: team.college,
      checked_in: true,
      event_id: event.id,
      event_title: event.title,
      present_count: presentCount,
      current_count: currentCount,
      new_count: newCount,
      remaining_count: presentCount - newCount,
      total_members: members.length,
      members,
    };
  }

  // 3. Rule: Unlimited counter
  const existingRecords = mockDb.custom_records.filter(
    (r) => r.event_id === eventId && r.team_id === team.id
  );
  const currentCount = existingRecords.reduce((acc, r) => acc + r.count, 0);
  const newCount = currentCount + requestedCount;

  const record: ScanEventRecord = {
    id: `rec-${randomUUID()}`,
    event_id: eventId,
    team_id: team.id,
    count: requestedCount,
    present_member_ids: presentMemberIds || null,
    scanned_at: new Date().toISOString(),
  };

  mockDb.custom_records.push(record);
  persistLocalDataset();

  return {
    success: true,
    message: `Recorded ${requestedCount} for "${team.team_name}" (Total: ${newCount} for ${event.title})`,
    team_id: team.id,
    team_name: team.team_name,
    college: team.college,
    checked_in: team.checked_in,
    event_id: event.id,
    event_title: event.title,
    current_count: currentCount,
    new_count: newCount,
    total_members: members.length,
    present_count: presentCount,
    members,
  };
}

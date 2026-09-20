import { Team, Member, Announcement, ScheduleItem, ScanResult, EventStatistics, MealType, TeamReviewStatus } from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import { validateMealEligibility } from '@/lib/validation/rules';
import { generateQRToken } from '@/lib/qr/token';
import { normalizeEmail, normalizePhone, canonicalizeTeamName, type Track } from '@/lib/registration';
import { randomUUID } from 'crypto';

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

// In-Memory store with NIRMAAN 2026 reference teams (50 teams)
interface MockDatabase {
  teams: Team[];
  members: Member[];
  announcements: Announcement[];
  schedule: ScheduleItem[];
}

const mockDb: MockDatabase = {
  teams: JSON.parse(JSON.stringify(seededDataset.teams)) as Team[],
  members: JSON.parse(JSON.stringify(seededDataset.members)) as Member[],
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
};

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
// Data Access Operations
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
        .eq('qr_token', token)
        .maybeSingle();

      if (error) {
        console.error('[Supabase] findTeamByToken error:', error.message, error.code);
      }
      if (!error && data) return data as Team;
    } catch (e) {
      console.error('[Supabase] findTeamByToken exception:', e);
    }
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  return team ? { ...team } : null;
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
        console.error('[Supabase] findTeamById error:', error.message, error.code);
      }
      if (!error && data) return data as Team;
    } catch (e) {
      console.error('[Supabase] findTeamById exception:', e);
    }
  }

  const team = mockDb.teams.find((t) => t.id === teamId);
  return team ? { ...team } : null;
}

export async function getTeamMembers(teamId: string): Promise<Member[]> {
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
        console.error('[Supabase] getTeamMembers error:', error.message, error.code);
      }
      if (!error && data) return data as Member[];
    } catch (e) {
      console.error('[Supabase] getTeamMembers exception:', e);
    }
  }

  return mockDb.members.filter((m) => m.team_id === teamId).map((m) => ({ ...m }));
}

export async function getAllTeams(): Promise<(Team & { members: Member[]; present_count: number; total_members: number })[]> {
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data: teams, error: teamsError } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: true });

      if (!teamsError && teams && teams.length > 0) {
        return teams.map((team: Team) => {
          const teamMembers = (members || []).filter((m: Member) => m.team_id === team.id);
          const present = teamMembers.filter((m: Member) => m.present).length;
          return {
            ...team,
            members: teamMembers,
            present_count: present,
            total_members: teamMembers.length,
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  return mockDb.teams.map((team) => {
    const teamMembers = mockDb.members.filter((m) => m.team_id === team.id);
    const present = teamMembers.filter((m) => m.present).length;
    return {
      ...team,
      members: teamMembers,
      present_count: present,
      total_members: teamMembers.length,
    };
  });
}

// -----------------------------------------------------------------------------
// Live Scan Operations (Atomic Server Execution)
// -----------------------------------------------------------------------------

export async function processMealScan(rawToken: string, mealType: MealType): Promise<ScanResult> {
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
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

export async function processCoffeeScan(rawToken: string): Promise<ScanResult> {
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
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

  team.coffee_count += 1;
  team.updated_at = new Date().toISOString();

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
  const token = sanitizeQRToken(rawToken);

  if (hasSupabaseConfig()) {
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
  members: { name: string; email: string; phone: string }[];
}

export async function updateTeamDetails(
  teamId: string,
  input: UpdateTeamDetailsInput
): Promise<{ success: boolean; message: string; team?: Team; members?: Member[] }> {
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

      const existingPresentEmails = new Set(
        (existingMembers || []).filter((m: Member) => m.present).map((m: Member) => normalizeEmail(m.email))
      );

      await supabase.from('members').delete().eq('team_id', teamId);

      const newMembers = allMembersInput.map((member, index) => ({
        id: `${teamId}-member-${index + 1}-${Date.now()}`,
        team_id: teamId,
        name: member.name.trim(),
        phone: member.phone.trim(),
        normalized_phone: normalizePhone(member.phone),
        email: normalizeEmail(member.email),
        normalized_email: normalizeEmail(member.email),
        present: existingPresentEmails.has(normalizeEmail(member.email)),
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
  const existingPresentEmails = new Set(
    existingMembers.filter((m) => m.present).map((m) => normalizeEmail(m.email))
  );

  mockDb.members = mockDb.members.filter((m) => m.team_id !== teamId);

  const updatedMembers: Member[] = allMembersInput.map((member, index) => ({
    id: `${teamId}-member-${index + 1}-${Date.now()}`,
    team_id: teamId,
    name: member.name.trim(),
    phone: member.phone.trim(),
    normalized_phone: normalizePhone(member.phone),
    email: normalizeEmail(member.email),
    normalized_email: normalizeEmail(member.email),
    present: existingPresentEmails.has(normalizeEmail(member.email)),
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

export async function getEventStatistics(): Promise<EventStatistics> {
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('get_event_statistics');

      if (error) {
        console.error('[Supabase] get_event_statistics error:', error.message);
      } else if (data) {
        return data as EventStatistics;
      }
    } catch (e) {
      console.error('[Supabase] get_event_statistics exception:', e);
    }
  }

  const activeTeams = mockDb.teams.filter((t) => t.review_status !== 'rejected' && t.review_status !== 'merged');
  const totalTeams = activeTeams.length;
  const checkedInTeams = activeTeams.filter((t) => t.checked_in).length;
  const activeMembers = mockDb.members.filter((m) => {
    const team = mockDb.teams.find((t) => t.id === m.team_id);
    return team && team.review_status !== 'rejected' && team.review_status !== 'merged';
  });
  const totalStudents = activeMembers.length;
  const presentStudents = activeMembers.filter((m) => m.present).length;
  const breakfastServed = activeTeams.reduce((acc, t) => acc + t.breakfast_count, 0);
  const lunchServed = activeTeams.reduce((acc, t) => acc + t.lunch_count, 0);
  const dinnerServed = activeTeams.reduce((acc, t) => acc + t.dinner_count, 0);
  const totalCoffee = activeTeams.reduce((acc, t) => acc + t.coffee_count, 0);

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
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (onlyPublished) query = query.eq('published', true);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Announcement[];
    } catch {
      // Fallback
    }
  }

  let list = mockDb.announcements;
  if (onlyPublished) {
    list = list.filter((a) => a.published);
  }
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id' | 'created_at'>): Promise<Announcement> {
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
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('schedule')
        .select('*')
        .order('order_index', { ascending: true });
      if (!error && data && data.length > 0) return data as ScheduleItem[];
    } catch {
      // Fallback to local store
    }
  }

  return [...mockDb.schedule].sort((a, b) => a.order_index - b.order_index);
}

export async function createScheduleItem(
  item: Omit<ScheduleItem, 'id' | 'created_at' | 'order_index'> & { order_index?: number }
): Promise<ScheduleItem> {
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

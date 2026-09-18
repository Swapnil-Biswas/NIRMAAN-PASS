import { Team, Member, Announcement, ScheduleItem, ScanResult, EventStatistics, MealType } from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import { validateMealEligibility } from '@/lib/validation/rules';

import seededDataset from './seeded_teams.json';

export const DEFAULT_SCHEDULE: ScheduleItem[] = [];

// In-Memory store with real NIRMAAN 2026 teams (289 teams, 908 members)
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

function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
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

      if (!error && data) return data as Team;
    } catch {
      // Fallback to local store
    }
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
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

      if (!error && data && data.length > 0) return data as Member[];
    } catch {
      // Fallback
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
      const { data: members } = await supabase.from('members').select('*');

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
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_meal_scan', {
        p_qr_token: token,
        p_meal_type: mealType,
      });

      if (!error && data) {
        return data as ScanResult;
      }
    } catch {
      // Fallback
    }
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
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_coffee_scan', {
        p_qr_token: token,
      });

      if (!error && data) {
        return data as ScanResult;
      }
    } catch {
      // Fallback
    }
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return {
      success: false,
      error_code: 'INVALID_QR',
      message: 'Invalid QR — Team not found.',
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
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('process_registration', {
        p_qr_token: token,
        p_present_member_ids: presentMemberIds,
      });

      if (!error && data) {
        return data as ScanResult;
      }
    } catch {
      // Fallback
    }
  }

  const team = mockDb.teams.find((t) => t.qr_token === token || t.qr_token === rawToken.trim());
  if (!team) {
    return {
      success: false,
      error_code: 'INVALID_QR',
      message: 'Invalid QR — Team not found.',
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

export async function getEventStatistics(): Promise<EventStatistics> {
  if (hasSupabaseConfig()) {
    try {
      const { createAdminClient } = await import('../supabase/admin');
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc('get_event_statistics');

      if (!error && data && (data as EventStatistics).total_teams > 0) {
        return data as EventStatistics;
      }
    } catch {
      // Fallback
    }
  }

  const totalTeams = mockDb.teams.length;
  const checkedInTeams = mockDb.teams.filter((t) => t.checked_in).length;
  const totalStudents = mockDb.members.length;
  const presentStudents = mockDb.members.filter((m) => m.present).length;
  const breakfastServed = mockDb.teams.reduce((acc, t) => acc + t.breakfast_count, 0);
  const lunchServed = mockDb.teams.reduce((acc, t) => acc + t.lunch_count, 0);
  const dinnerServed = mockDb.teams.reduce((acc, t) => acc + t.dinner_count, 0);
  const totalCoffee = mockDb.teams.reduce((acc, t) => acc + t.coffee_count, 0);

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

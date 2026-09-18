import { Team, Member, Announcement, ScanResult, EventStatistics, MealType } from '@/types/database';
import { sanitizeQRToken } from '@/lib/qr/token';
import { validateMealEligibility } from '@/lib/validation/rules';

import seededDataset from './seeded_teams.json';

// In-Memory fallback store with real NIRMAAN 2026 teams + demo presets
interface MockDatabase {
  teams: Team[];
  members: Member[];
  announcements: Announcement[];
}

// Preset demo teams for quick testing
const demoTeams: Team[] = [
  {
    id: 'team-alpha-001',
    team_name: 'Team Alpha (ByteCrafters)',
    college: 'IIT Bombay',
    auth_id: null,
    qr_token: 'nirmaan_alpha_9281a',
    checked_in: true,
    breakfast_count: 3,
    lunch_count: 2,
    dinner_count: 0,
    coffee_count: 14,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'team-beta-002',
    team_name: 'Team Beta (NeuralKnights)',
    college: 'BITS Pilani',
    auth_id: null,
    qr_token: 'nirmaan_beta_4812b',
    checked_in: false,
    breakfast_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    coffee_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'team-gamma-003',
    team_name: 'Team Gamma (CyberVanguard)',
    college: 'IIIT Hyderabad',
    auth_id: null,
    qr_token: 'nirmaan_gamma_7723c',
    checked_in: true,
    breakfast_count: 4,
    lunch_count: 4,
    dinner_count: 3,
    coffee_count: 21,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const demoMembers: Member[] = [
  { id: 'm-alpha-1', team_id: 'team-alpha-001', name: 'Aarav Sharma', phone: '+91 98765 43210', email: 'aarav@alpha.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-alpha-2', team_id: 'team-alpha-001', name: 'Riya Patel', phone: '+91 98765 43211', email: 'riya@alpha.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-alpha-3', team_id: 'team-alpha-001', name: 'Vikram Joshi', phone: '+91 98765 43212', email: 'vikram@alpha.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-alpha-4', team_id: 'team-alpha-001', name: 'Ananya Rao', phone: '+91 98765 43213', email: 'ananya@alpha.edu', present: false, created_at: new Date().toISOString() },
  { id: 'm-beta-1', team_id: 'team-beta-002', name: 'Dev Mehta', phone: '+91 91234 56780', email: 'dev@beta.edu', present: false, created_at: new Date().toISOString() },
  { id: 'm-beta-2', team_id: 'team-beta-002', name: 'Neha Gupta', phone: '+91 91234 56781', email: 'neha@beta.edu', present: false, created_at: new Date().toISOString() },
  { id: 'm-beta-3', team_id: 'team-beta-002', name: 'Kabir Singh', phone: '+91 91234 56782', email: 'kabir@beta.edu', present: false, created_at: new Date().toISOString() },
  { id: 'm-gamma-1', team_id: 'team-gamma-003', name: 'Siddharth Roy', phone: '+91 99887 76650', email: 'siddharth@gamma.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-gamma-2', team_id: 'team-gamma-003', name: 'Pooja Nair', phone: '+91 99887 76651', email: 'pooja@gamma.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-gamma-3', team_id: 'team-gamma-003', name: 'Tanmay Saxena', phone: '+91 99887 76652', email: 'tanmay@gamma.edu', present: true, created_at: new Date().toISOString() },
  { id: 'm-gamma-4', team_id: 'team-gamma-003', name: 'Ishita Sen', phone: '+91 99887 76653', email: 'ishita@gamma.edu', present: true, created_at: new Date().toISOString() },
];

const mockDb: MockDatabase = {
  teams: [...demoTeams, ...(seededDataset.teams as Team[])],
  members: [...demoMembers, ...(seededDataset.members as Member[])],
  announcements: [
    {
      id: 'ann-1',
      title: 'WELCOME TO NIRMAAN 2026',
      message: 'Opening ceremony starts at 10:00 AM in Main Auditorium. Ensure all team members have completed on-desk registration.',
      priority: 'important',
      published: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'ann-2',
      title: 'LUNCH COUNTER OPEN',
      message: 'Lunch is served from 1:00 PM to 2:30 PM at Food Hall B. Present your team QR code at the food counter.',
      priority: 'normal',
      published: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'ann-3',
      title: 'MENTORSHIP ROUND 1 STARTING',
      message: 'Domain mentors are visiting assigned team bays. Keep your architecture diagrams and repos ready.',
      priority: 'urgent',
      published: true,
      created_at: new Date().toISOString(),
    },
  ],
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
        .or(`qr_token.eq.${token},qr_token.eq.${rawToken.trim()}`)
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

      if (!error && data) return data as Member[];
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
      const { data: teams } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      const { data: members } = await supabase.from('members').select('*');

      if (teams) {
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

      if (!error && data) {
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
      if (!error && data) return data as Announcement[];
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

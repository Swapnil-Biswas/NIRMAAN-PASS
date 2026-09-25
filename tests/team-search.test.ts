import { describe, it, expect } from 'vitest';
import seededDataset from '@/lib/data/seeded_teams.json';
import { Team, Member } from '@/types/database';

interface EnrichedTeam extends Team {
  members: Member[];
  present_count: number;
  total_members: number;
}

function filterTeams(
  teams: EnrichedTeam[],
  search: string,
  statusFilter: 'all' | 'checked_in' | 'not_checked_in' = 'all'
) {
  return teams.filter((t) => {
    const q = search.trim().toLowerCase();

    if (q) {
      const qDigits = q.replace(/\D/g, '');
      const isPhoneSearch = /^[\d\s+\-()]+$/.test(q) && qDigits.length >= 4;
      const teamName = (t.team_name || '').toLowerCase();
      const canonical = (t.canonical_name || '').toLowerCase();
      const college = (t.college || '').toLowerCase();
      const track = (t.track || '').toLowerCase();
      const qrToken = (t.qr_token || '').toLowerCase();
      const teamId = (t.id || '').toLowerCase();

      // Check team-level fields
      const matchesTeam =
        teamName.includes(q) ||
        canonical.includes(q) ||
        college.includes(q) ||
        track.includes(q) ||
        qrToken.includes(q) ||
        teamId.includes(q);

      // Check all member fields (name, email, phone)
      const members = Array.isArray(t.members) ? t.members : [];
      const matchesMember = members.some((m) => {
        if (!m) return false;
        const name = (m.name || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        const phone = String(m.phone || '');
        const phoneDigits = phone.replace(/\D/g, '');

        return (
          name.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          (isPhoneSearch && phoneDigits.includes(qDigits))
        );
      });

      if (!matchesTeam && !matchesMember) {
        return false;
      }
    }

    if (statusFilter === 'checked_in') {
      return t.checked_in;
    }
    if (statusFilter === 'not_checked_in') {
      return !t.checked_in;
    }
    return true;
  });
}

describe('TeamsTable Search Logic Tests', () => {
  const teams: EnrichedTeam[] = (seededDataset.teams as Team[]).map((t) => {
    const members = (seededDataset.members as Member[]).filter((m) => m.team_id === t.id);
    return {
      ...t,
      members,
      present_count: members.filter((m) => m.present).length,
      total_members: members.length,
    };
  });

  it('loads all 50 seeded teams when search query is empty', () => {
    const result = filterTeams(teams, '');
    expect(result.length).toBe(50);
  });

  it('filters by team name case-insensitively', () => {
    const result = filterTeams(teams, 'aeronex');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('AERONEX');
  });

  it('filters by partial team name', () => {
    const result = filterTeams(teams, '3 byte');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('3 byte builders');
  });

  it('filters by college name', () => {
    const result = filterTeams(teams, 'Hubli');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((t) => t.college.includes('Hubli'))).toBe(true);
  });

  it('filters by track name', () => {
    const result = filterTeams(teams, 'Smart Mobility');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((t) => {
      expect(t.track).toContain('Smart Mobility');
    });
  });

  it('filters by team ID (e.g. team-022)', () => {
    const result = filterTeams(teams, 'team-022');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('team-022');
  });

  it('filters by QR token suffix', () => {
    const result = filterTeams(teams, '840c467a92f68dd6');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('AERONEX');
  });

  it('filters by leader/member name', () => {
    const result = filterTeams(teams, 'Amith H P');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('3 byte builders');
  });

  it('filters by member email', () => {
    const result = filterTeams(teams, 'amithveerapura@gmail.com');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('3 byte builders');
  });

  it('filters by phone number with formatting differences', () => {
    const result = filterTeams(teams, '6360728976');
    expect(result.length).toBe(1);
    expect(result[0].team_name).toBe('3 byte builders');
  });

  it('handles null/undefined members defensively without throwing', () => {
    const corruptedTeam: EnrichedTeam = {
      id: 'team-corrupted',
      team_name: 'Corrupted Team',
      college: 'Test College',
      auth_id: null,
      qr_token: 'token_corrupted',
      checked_in: false,
      breakfast_count: 0,
      lunch_count: 0,
      dinner_count: 0,
      coffee_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: undefined as any,
      present_count: 0,
      total_members: 0,
    };

    expect(() => filterTeams([corruptedTeam], 'test')).not.toThrow();
  });

  it('combines status filter (checked_in) with search query', () => {
    const allMatching = filterTeams(teams, 'builders', 'all');
    expect(allMatching.length).toBe(1);

    const checkedInMatching = filterTeams(teams, 'builders', 'checked_in');
    expect(checkedInMatching.length).toBe(0); // None checked in initially

    const notCheckedInMatching = filterTeams(teams, 'builders', 'not_checked_in');
    expect(notCheckedInMatching.length).toBe(1);
  });
});

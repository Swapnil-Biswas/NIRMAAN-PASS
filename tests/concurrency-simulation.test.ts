import { describe, it, expect } from 'vitest';
import {
  processMealScan,
  processCoffeeScan,
  processRegistration,
  processCustomScan,
  findTeamByTokenDirect,
  findTeamByToken,
  findTeamByMemberEmail,
  getTeamMembers,
  createTeam,
  createCustomScanEvent,
  updateTeamReviewStatus,
} from '@/lib/data/store';
import { generateQRToken } from '@/lib/qr/token';

describe('Production Concurrency & Burst Simulation Suite', () => {
  // ---------------------------------------------------------------------------
  // Scenario A: Concurrent Meal Scanning on Same Team (Burst Race Condition)
  // ---------------------------------------------------------------------------
  it('Scenario A: 10 concurrent meal scans on a team with 2 present members allow exactly 2 and reject 8', async () => {
    const team = await createTeam({
      teamName: 'Concurrent Hackers',
      college: 'MIT Tech',
      track: 'Cyber-Physical Security & Defense',
      leader: { name: 'Alice', phone: '1111111111', email: 'alice.burst@test.com' },
      members: [
        { name: 'Bob', phone: '2222222222', email: 'bob.burst@test.com' },
        { name: 'Charlie', phone: '3333333333', email: 'charlie.burst@test.com' },
      ],
    });

    const members = await getTeamMembers(team.id);
    const token = team.qr_token;

    // Check-in Alice and Bob (2 members present, Charlie absent)
    const presentIds = members.filter((m) => m.email !== 'charlie.burst@test.com').map((m) => m.id);
    await processRegistration(token, presentIds);

    // Fire 10 simultaneous scan requests for lunch
    const scanPromises = Array.from({ length: 10 }).map(() => processMealScan(token, 'lunch'));
    const results = await Promise.all(scanPromises);

    const successfulScans = results.filter((r) => r.success);
    const rejectedScans = results.filter((r) => !r.success);

    expect(successfulScans.length).toBe(2);
    expect(rejectedScans.length).toBe(8);

    // Verify error code on all rejected attempts
    rejectedScans.forEach((r) => {
      expect(['LIMIT_REACHED', 'ALREADY_SERVED', 'MEAL_LIMIT_REACHED']).toContain(r.error_code);
    });

    // Check final team state directly
    const refreshedTeam = await findTeamByTokenDirect(token);
    expect(refreshedTeam).toBeDefined();
    expect(refreshedTeam?.lunch_count).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Scenario B: Multi-Device High Concurrency Across Multiple Teams
  // ---------------------------------------------------------------------------
  it('Scenario B: 50 concurrent scans distributed across 5 different teams strictly respect individual quotas', async () => {
    const teamsData = await Promise.all(
      [1, 2, 3, 4, 5].map(async (count) => {
        const otherMembers = Array.from({ length: count - 1 }).map((_, idx) => ({
          name: `Member_${count}_${idx}`,
          phone: `999000${count}${idx}`,
          email: `team${count}.m${idx}@test.com`,
        }));

        const team = await createTeam({
          teamName: `Concurrent Team ${count}`,
          college: `College ${count}`,
          track: 'AI & Machine Learning Track',
          leader: { name: `Leader ${count}`, phone: `999111${count}00`, email: `team${count}.lead@test.com` },
          members: otherMembers,
        });

        const members = await getTeamMembers(team.id);
        const presentIds = members.map((m) => m.id);
        await processRegistration(team.qr_token, presentIds);

        return { team, token: team.qr_token, presentCount: count };
      })
    );

    // Each team gets 10 concurrent dinner scan requests (50 requests total)
    const allScanRequests = teamsData.flatMap(({ token }) =>
      Array.from({ length: 10 }).map(() => processMealScan(token, 'dinner'))
    );

    const allResults = await Promise.all(allScanRequests);
    expect(allResults.length).toBe(50);

    // Verify each team received exactly presentCount meals
    for (const { token, presentCount } of teamsData) {
      const refreshed = await findTeamByTokenDirect(token);
      expect(refreshed?.dinner_count).toBe(presentCount);
    }
  });

  // ---------------------------------------------------------------------------
  // Scenario C: Custom Scan Event (once_per_team) Under Concurrency
  // ---------------------------------------------------------------------------
  it('Scenario C: 10 concurrent requests for once_per_team custom event allow exactly 1 and reject 9', async () => {
    const event = await createCustomScanEvent({
      title: 'Welcome Goodies Kit',
      description: 'Collect 1 kit per team',
      limit_rule: 'once_per_team',
      active: true,
      color: 'bg-emerald-500',
    });

    const team = await createTeam({
      teamName: 'Goodies Claimers',
      college: 'NIT Tech',
      track: 'General',
      leader: { name: 'David', phone: '4444444444', email: 'david.kit@test.com' },
      members: [],
    });

    const members = await getTeamMembers(team.id);
    await processRegistration(team.qr_token, members.map((m) => m.id));

    const scanPromises = Array.from({ length: 10 }).map(() => processCustomScan(team.qr_token, event.id, 1));
    const results = await Promise.all(scanPromises);

    const success = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(success.length).toBe(1);
    expect(failed.length).toBe(9);
    failed.forEach((f) => {
      expect(f.error_code).toBe('ALREADY_COMPLETED');
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario D: Custom Scan Event (per_present_member) Under Concurrency
  // ---------------------------------------------------------------------------
  it('Scenario D: 10 concurrent single-badge scans for a 3-present-member team allow exactly 3 and reject 7', async () => {
    const event = await createCustomScanEvent({
      title: 'NFC Identity Badges',
      description: '1 badge per present member',
      limit_rule: 'per_present_member',
      active: true,
      color: 'bg-blue-500',
    });

    const team = await createTeam({
      teamName: 'Badge Seekers',
      college: 'BITS Pilani',
      track: 'Open Innovation',
      leader: { name: 'Dev1', phone: '5550001111', email: 'dev1.badge@test.com' },
      members: [
        { name: 'Dev2', phone: '5550002222', email: 'dev2.badge@test.com' },
        { name: 'Dev3', phone: '5550003333', email: 'dev3.badge@test.com' },
        { name: 'Dev4', phone: '5550004444', email: 'dev4.badge@test.com' },
      ],
    });

    const members = await getTeamMembers(team.id);
    // Mark 3 present (Dev1, Dev2, Dev3), Dev4 absent
    const presentIds = members.filter((m) => m.email !== 'dev4.badge@test.com').map((m) => m.id);
    await processRegistration(team.qr_token, presentIds);

    const scanPromises = Array.from({ length: 10 }).map(() => processCustomScan(team.qr_token, event.id, 1));
    const results = await Promise.all(scanPromises);

    const success = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(success.length).toBe(3);
    expect(failed.length).toBe(7);
    failed.forEach((f) => {
      expect(f.error_code).toBe('LIMIT_REACHED');
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario E: Direct Single-Row QR & Email Lookups Under High Concurrency
  // ---------------------------------------------------------------------------
  it('Scenario E: 50 concurrent direct token and email lookups execute without state corruption', async () => {
    const testEmail = 'direct.lookup@test.com';

    const team = await createTeam({
      teamName: 'Direct Lookup Test Team',
      college: 'Stanford Tech',
      track: 'Robotics & Hardware',
      leader: { name: 'Elena', phone: '6667778888', email: testEmail },
      members: [],
    });

    // 25 token lookups + 25 email lookups simultaneously
    const tokenLookups = Array.from({ length: 25 }).map(() => findTeamByTokenDirect(team.qr_token));
    const emailLookups = Array.from({ length: 25 }).map(() => findTeamByMemberEmail(testEmail));

    const [tokenResults, emailResults] = await Promise.all([
      Promise.all(tokenLookups),
      Promise.all(emailLookups),
    ]);

    expect(tokenResults.length).toBe(25);
    tokenResults.forEach((t) => {
      expect(t).toBeDefined();
      expect(t?.team_name).toBe('Direct Lookup Test Team');
    });

    expect(emailResults.length).toBe(25);
    emailResults.forEach((res) => {
      expect(res).toBeDefined();
      expect(res?.team?.team_name).toBe('Direct Lookup Test Team');
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario F: Revoked / Disqualified Teams Under Concurrency
  // ---------------------------------------------------------------------------
  it('Scenario F: 10 concurrent scan requests to a rejected/revoked team are all rejected', async () => {
    const team = await createTeam({
      teamName: 'Revoked Team',
      college: 'Test College',
      track: 'General',
      leader: { name: 'Frank', phone: '7778889999', email: 'frank.revoked@test.com' },
      members: [],
    });

    const members = await getTeamMembers(team.id);
    await processRegistration(team.qr_token, members.map((m) => m.id));

    // Disqualify / reject team
    await updateTeamReviewStatus(team.id, 'rejected', 'Violated code of conduct');

    const scanPromises = Array.from({ length: 10 }).map(() => processMealScan(team.qr_token, 'breakfast'));
    const results = await Promise.all(scanPromises);

    const success = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(success.length).toBe(0);
    expect(failed.length).toBe(10);
    failed.forEach((f) => {
      expect(f.error_code).toBe('TOKEN_REVOKED');
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario G: High-Frequency Coffee / Refreshment Scanning
  // ---------------------------------------------------------------------------
  it('Scenario G: 20 concurrent coffee scans increment the counter accurately to 20', async () => {
    const team = await createTeam({
      teamName: 'Coffee Addicts',
      college: 'Caffeine Univ',
      track: 'Energy Track',
      leader: { name: 'Grace', phone: '8889990000', email: 'grace.coffee@test.com' },
      members: [],
    });

    const coffeePromises = Array.from({ length: 20 }).map(() => processCoffeeScan(team.qr_token));
    const results = await Promise.all(coffeePromises);

    const success = results.filter((r) => r.success);
    expect(success.length).toBe(20);

    const refreshed = await findTeamByTokenDirect(team.qr_token);
    expect(refreshed?.coffee_count).toBe(20);
  });
});

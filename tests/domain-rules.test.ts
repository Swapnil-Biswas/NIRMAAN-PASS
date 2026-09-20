import { describe, it, expect, beforeEach } from 'vitest';
import { calculateMealEntitlement, validateMealEligibility } from '@/lib/validation/rules';
import { generateQRToken, formatQRPayload, sanitizeQRToken, isValidTokenFormat } from '@/lib/qr/token';
import { Team, Member } from '@/types/database';
import { processMealScan, processCoffeeScan, processRegistration, findTeamByToken, createTeam, getTeamMembers } from '@/lib/data/store';

describe('QR Token Utilities', () => {
  it('generates random, valid non-guessable tokens', () => {
    const token1 = generateQRToken();
    const token2 = generateQRToken();
    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).not.toEqual(token2);
    expect(isValidTokenFormat(token1)).toBe(true);
  });

  it('correctly formats and sanitizes QR payloads', () => {
    const raw = 'test_token_12345';
    const payload = formatQRPayload(raw);
    expect(payload).toBe('NIRMAAN-PASS:test_token_12345');
    expect(sanitizeQRToken(payload)).toBe('test_token_12345');
    expect(sanitizeQRToken('  NIRMAAN-PASS:abc_123  ')).toBe('abc_123');
  });
});

describe('Domain Rules & Meal Entitlement', () => {
  const dummyTeam: Team = {
    id: 't-100',
    team_name: 'Test Team',
    college: 'Test College',
    auth_id: null,
    qr_token: 'test_token',
    checked_in: true,
    breakfast_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    coffee_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyMembers: Member[] = [
    { id: 'm-1', team_id: 't-100', name: 'Alice', phone: '123', email: 'a@test.com', present: true, created_at: '' },
    { id: 'm-2', team_id: 't-100', name: 'Bob', phone: '123', email: 'b@test.com', present: true, created_at: '' },
    { id: 'm-3', team_id: 't-100', name: 'Charlie', phone: '123', email: 'c@test.com', present: false, created_at: '' },
  ];

  it('calculates entitlement based strictly on present count (2 of 3 present)', () => {
    const entitlement = calculateMealEntitlement(dummyMembers);
    expect(entitlement).toBe(2);
  });

  it('allows meal scan up to present count and blocks when full', () => {
    const freshTeam = { ...dummyTeam, lunch_count: 1 };
    const result1 = validateMealEligibility(freshTeam, dummyMembers, 'lunch');
    expect(result1.eligible).toBe(true);
    expect(result1.presentCount).toBe(2);

    const fullTeam = { ...dummyTeam, lunch_count: 2 };
    const result2 = validateMealEligibility(fullTeam, dummyMembers, 'lunch');
    expect(result2.eligible).toBe(false);
    expect(result2.errorCode).toBe('MEAL_LIMIT_REACHED');
  });
});

describe('Store Operations (Meals, Coffee, Registration)', () => {
  it('on-desk registration sets checked_in and updates present members', async () => {
    const team = await createTeam({
      teamName: 'Alpha Team',
      college: 'Test Tech',
      track: 'Cyber-Physical Security & Defense',
      leader: { name: 'Leader One', email: 'leader1@test.com', phone: '1234567890' },
      members: [
        { name: 'Member Two', email: 'mem2@test.com', phone: '1234567891' },
        { name: 'Member Three', email: 'mem3@test.com', phone: '1234567892' },
      ],
    });

    const members = await getTeamMembers(team.id);
    const token = team.qr_token;
    const regRes = await processRegistration(token, [members[0].id, members[1].id]);
    expect(regRes.success).toBe(true);
    expect(regRes.checked_in).toBe(true);
    expect(regRes.present_count).toBe(2);

    // Now lunch scan should work for up to 2 servings
    const lunchRes1 = await processMealScan(token, 'lunch');
    expect(lunchRes1.success).toBe(true);
    expect(lunchRes1.new_count).toBe(1);
    expect(lunchRes1.remaining_count).toBe(1);

    const lunchRes2 = await processMealScan(token, 'lunch');
    expect(lunchRes2.success).toBe(true);
    expect(lunchRes2.new_count).toBe(2);
    expect(lunchRes2.remaining_count).toBe(0);

    // 3rd scan should be rejected
    const lunchRes3 = await processMealScan(token, 'lunch');
    expect(lunchRes3.success).toBe(false);
    expect(lunchRes3.error_code).toBe('MEAL_LIMIT_REACHED');
  });

  it('coffee scans are unlimited and increment every time', async () => {
    const team = await createTeam({
      teamName: 'Coffee Lovers',
      college: 'Test Tech',
      track: 'Deep Tech & Edge AI',
      leader: { name: 'Leader Coffee', email: 'coffee@test.com', phone: '1234567890' },
      members: [],
    });

    const token = team.qr_token;
    const res1 = await processCoffeeScan(token);
    expect(res1.success).toBe(true);
    const count1 = res1.new_count!;

    const res2 = await processCoffeeScan(token);
    expect(res2.success).toBe(true);
    expect(res2.new_count).toBe(count1 + 1);
  });

  it('rejects meal scan when team is not checked in', async () => {
    const team = await createTeam({
      teamName: 'Unregistered Team',
      college: 'Test Tech',
      track: 'AgriTech' as any,
      leader: { name: 'Unreg Leader', email: 'unreg@test.com', phone: '1234567890' },
      members: [],
    });

    const token = team.qr_token;
    const scanRes = await processMealScan(token, 'breakfast');
    expect(scanRes.success).toBe(false);
    expect(scanRes.error_code).toBe('NOT_CHECKED_IN');
  });

  it('rejects scans with invalid or unknown QR tokens', async () => {
    const invalidScan = await processMealScan('invalid_nonexistent_token', 'lunch');
    expect(invalidScan.success).toBe(false);
    expect(invalidScan.error_code).toBe('INVALID_QR');

    const invalidCoffee = await processCoffeeScan('unknown_token_xyz');
    expect(invalidCoffee.success).toBe(false);
    expect(invalidCoffee.error_code).toBe('INVALID_QR');

    const invalidTeam = await findTeamByToken('non_existent_token_123');
    expect(invalidTeam).toBeNull();
  });
});

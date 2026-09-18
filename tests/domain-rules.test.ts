import { describe, it, expect, beforeEach } from 'vitest';
import { calculateMealEntitlement, validateMealEligibility } from '@/lib/validation/rules';
import { generateQRToken, formatQRPayload, sanitizeQRToken, isValidTokenFormat } from '@/lib/qr/token';
import { Team, Member } from '@/types/database';
import { processMealScan, processCoffeeScan, processRegistration, findTeamByToken } from '@/lib/data/store';

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
    qr_token: 'test_token_100',
    checked_in: true,
    breakfast_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    coffee_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyMembers: Member[] = [
    { id: 'm1', team_id: 't-100', name: 'Member 1', phone: '123', email: 'm1@test.com', present: true, created_at: '' },
    { id: 'm2', team_id: 't-100', name: 'Member 2', phone: '123', email: 'm2@test.com', present: true, created_at: '' },
    { id: 'm3', team_id: 't-100', name: 'Member 3', phone: '123', email: 'm3@test.com', present: false, created_at: '' },
    { id: 'm4', team_id: 't-100', name: 'Member 4', phone: '123', email: 'm4@test.com', present: false, created_at: '' },
  ];

  it('entitlement is strictly equal to count of present members (2 present out of 4)', () => {
    const entitlement = calculateMealEntitlement(dummyMembers);
    expect(entitlement).toBe(2);
  });

  it('rejects meal if team is not checked in', () => {
    const uncheckedTeam = { ...dummyTeam, checked_in: false };
    const result = validateMealEligibility(uncheckedTeam, dummyMembers, 'lunch');
    expect(result.eligible).toBe(false);
    expect(result.errorCode).toBe('NOT_CHECKED_IN');
  });

  it('allows meal if current count < present members', () => {
    const validTeam = { ...dummyTeam, lunch_count: 1 };
    const result = validateMealEligibility(validTeam, dummyMembers, 'lunch');
    expect(result.eligible).toBe(true);
    expect(result.presentCount).toBe(2);
  });

  it('rejects meal when limit is exactly reached (2/2)', () => {
    const fullTeam = { ...dummyTeam, lunch_count: 2 };
    const result = validateMealEligibility(fullTeam, dummyMembers, 'lunch');
    expect(result.eligible).toBe(false);
    expect(result.errorCode).toBe('MEAL_LIMIT_REACHED');
    expect(result.message).toContain('Lunch limit reached');
  });
});

describe('Store Operations (Meals, Coffee, Registration)', () => {
  it('processes meal scans sequentially up to present count', async () => {
    // Team Alpha has 3 present members, initial breakfast_count is 3
    const token = 'nirmaan_alpha_9281a';
    const initialTeam = await findTeamByToken(token);
    expect(initialTeam).toBeDefined();

    // Breakfast is already 3/3 -> should reject
    const scanRes = await processMealScan(token, 'breakfast');
    expect(scanRes.success).toBe(false);
    expect(scanRes.error_code).toBe('MEAL_LIMIT_REACHED');

    // Dinner is 0/3 -> should succeed
    const dinnerRes1 = await processMealScan(token, 'dinner');
    expect(dinnerRes1.success).toBe(true);
    expect(dinnerRes1.new_count).toBe(1);
    expect(dinnerRes1.remaining_count).toBe(2);

    const dinnerRes2 = await processMealScan(token, 'dinner');
    expect(dinnerRes2.success).toBe(true);
    expect(dinnerRes2.new_count).toBe(2);
  });

  it('coffee scans are unlimited and increment every time', async () => {
    const token = 'nirmaan_alpha_9281a';
    const res1 = await processCoffeeScan(token);
    expect(res1.success).toBe(true);
    const count1 = res1.new_count!;

    const res2 = await processCoffeeScan(token);
    expect(res2.success).toBe(true);
    expect(res2.new_count).toBe(count1 + 1);
  });

  it('on-desk registration sets checked_in and updates present members', async () => {
    // Team Beta is initially not checked in
    const token = 'nirmaan_beta_4812b';
    const regRes = await processRegistration(token, ['m-beta-1', 'm-beta-2']);
    expect(regRes.success).toBe(true);
    expect(regRes.checked_in).toBe(true);
    expect(regRes.present_count).toBe(2);
    expect(regRes.total_members).toBe(3);

    // Now lunch scan should work for up to 2 servings
    const lunchRes = await processMealScan(token, 'lunch');
    expect(lunchRes.success).toBe(true);
    expect(lunchRes.new_count).toBe(1);
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

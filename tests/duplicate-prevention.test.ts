import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeCollege,
  canonicalizeTeamName,
  calculateSimilarity,
  detectTeamDuplicates,
  RegistrationTeamInput,
  ExistingTeamWithMembers,
} from '@/lib/registration';
import {
  createTeam,
  getAllTeams,
  findTeamByToken,
  updateTeamReviewStatus,
  mergeDuplicateTeam,
  updateTeamDetails,
  processMealScan,
  processCoffeeScan,
  processRegistration,
} from '@/lib/data/store';
import { Team, Member } from '@/types/database';

describe('Anti-Duplicate Normalization Utilities', () => {
  it('normalizes email addresses correctly', () => {
    expect(normalizeEmail('  Leader@Example.COM  ')).toBe('leader@example.com');
    expect(normalizeEmail('user.name+tag@sub.domain.org')).toBe('user.name+tag@sub.domain.org');
  });

  it('normalizes various Indian and international phone number formats to 10 digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
    expect(normalizePhone('98765-43210')).toBe('9876543210');
    expect(normalizePhone('+91-9876543210')).toBe('9876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
  });

  it('canonicalizes team names by stripping punctuation, whitespace, and lowercasing', () => {
    expect(canonicalizeTeamName('  0x DEAD-BEEF!! ')).toBe('0xdeadbeef');
    expect(canonicalizeTeamName('Team_Alpha #1')).toBe('teamalpha1');
    expect(canonicalizeTeamName('Byte-Crafters ')).toBe('bytecrafters');
  });

  it('calculates Levenshtein similarity metric correctly', () => {
    expect(calculateSimilarity('Team ByteCraft', 'Team ByteCraft')).toBe(1.0);
    expect(calculateSimilarity('ByteCraft', 'ByteCrafts')).toBeGreaterThanOrEqual(0.85);
    expect(calculateSimilarity('Alpha Innovation', 'Beta Defense')).toBeLessThan(0.5);
  });
});

describe('Multi-Factor Anti-Duplicate Detection Engine', () => {
  const existingTeamA: ExistingTeamWithMembers = {
    id: 'team-existing-1',
    team_name: 'Quantum Hackers',
    canonical_name: 'quantumhackers',
    college: 'BMS Institute of Technology',
    auth_id: null,
    qr_token: 'token-alpha-1234',
    checked_in: false,
    breakfast_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    coffee_count: 0,
    track: 'Deep Tech & Edge AI',
    review_status: 'approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    members: [
      {
        id: 'm-1',
        team_id: 'team-existing-1',
        name: 'Rohan Sharma',
        phone: '+91 98765 43210',
        normalized_phone: '9876543210',
        email: 'rohan.sharma@bmsit.in',
        normalized_email: 'rohan.sharma@bmsit.in',
        present: false,
        created_at: '',
      },
      {
        id: 'm-2',
        team_id: 'team-existing-1',
        name: 'Pooja Verma',
        phone: '9123456780',
        normalized_phone: '9123456780',
        email: 'pooja.verma@bmsit.in',
        normalized_email: 'pooja.verma@bmsit.in',
        present: false,
        created_at: '',
      },
    ],
  };

  const existingTeamsList: ExistingTeamWithMembers[] = [existingTeamA];

  it('HARD BLOCKS registration if any participant email is already registered', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Cyber Knights',
      college: 'RV College of Engineering',
      track: 'Cyber-Physical Security & Defense',
      leader: {
        name: 'Amit Patel',
        email: 'ROHAN.sharma@bmsit.in', // Collision with existing member
        phone: '9988776655',
      },
      members: [
        {
          name: 'Kavita Rao',
          email: 'kavita@rvce.edu.in',
          phone: '9988776654',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('hard_block');
    expect(result.reviewStatus).toBe('rejected');
    expect(result.reason).toContain('Participant email is already registered');
  });

  it('HARD BLOCKS registration if any participant phone is already registered (even with different prefix)', () => {
    const input: RegistrationTeamInput = {
      teamName: 'RoboTech',
      college: 'PES University',
      track: 'Smart Mobility & Aerospace',
      leader: {
        name: 'Suresh Raina',
        email: 'suresh@pes.edu',
        phone: '09876543210', // Collision with Rohan's +91 98765 43210
      },
      members: [
        {
          name: 'Deepak Kumar',
          email: 'deepak@pes.edu',
          phone: '9845112233',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('hard_block');
    expect(result.reviewStatus).toBe('rejected');
    expect(result.reason).toContain('Participant contact number is already registered');
  });

  it('HARD BLOCKS registration if exact canonical team name + same college collides', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Quantum-Hackers!', // Same canonical name 'quantumhackers'
      college: 'BMS Institute of Technology',
      track: 'Deep Tech & Edge AI',
      leader: {
        name: 'Vikas Gupta',
        email: 'vikas@bmsit.in',
        phone: '9741001122',
      },
      members: [
        {
          name: 'Sneha Reddy',
          email: 'sneha@bmsit.in',
          phone: '9741001123',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('hard_block');
    expect(result.reviewStatus).toBe('rejected');
    expect(result.reason).toContain('already registered from BMS Institute of Technology');
  });

  it('FLAGS FOR REVIEW when 2 or more member names overlap from the same college', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Quantum 2.0',
      college: 'BMS Institute of Technology',
      track: 'Deep Tech & Edge AI',
      leader: {
        name: 'Rohan Sharma', // Match 1
        email: 'rohan.newemail@gmail.com',
        phone: '9555112233',
      },
      members: [
        {
          name: 'Pooja Verma', // Match 2
          email: 'pooja.newemail@gmail.com',
          phone: '9555112234',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('flag_duplicate');
    expect(result.reviewStatus).toBe('flagged_duplicate');
    expect(result.reason).toContain('participant names match');
  });

  it('FLAGS FOR REVIEW when team name has >= 82% similarity from the same college', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Quantum Hackerss', // Highly similar typo
      college: 'BMS Institute of Technology',
      track: 'Deep Tech & Edge AI',
      leader: {
        name: 'Arjun Das',
        email: 'arjun@bmsit.in',
        phone: '9666112233',
      },
      members: [
        {
          name: 'Meera Nair',
          email: 'meera@bmsit.in',
          phone: '9666112234',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('flag_duplicate');
    expect(result.reviewStatus).toBe('flagged_duplicate');
    expect(result.reason).toContain('similar');
  });

  it('FLAGS FOR REVIEW when generic canonical team name collides across DIFFERENT colleges', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Quantum Hackers', // Same name, but RVCE instead of BMSIT
      college: 'RV College of Engineering',
      track: 'HealthTech & Bio-Wearables',
      leader: {
        name: 'Tarun Rao',
        email: 'tarun@rvce.edu.in',
        phone: '9777112233',
      },
      members: [
        {
          name: 'Ananya Roy',
          email: 'ananya@rvce.edu.in',
          phone: '9777112234',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('flag_duplicate');
    expect(result.reviewStatus).toBe('flagged_duplicate');
    expect(result.reason).toContain('already used by another institution');
  });

  it('ALLOWS clean, non-colliding legitimate registrations', () => {
    const input: RegistrationTeamInput = {
      teamName: 'Aero Innovators',
      college: 'Indian Institute of Science',
      track: 'Smart Mobility & Aerospace',
      leader: {
        name: 'Dr. Ramesh Iyer',
        email: 'ramesh@iisc.ac.in',
        phone: '9888112233',
      },
      members: [
        {
          name: 'Sunita Menon',
          email: 'sunita@iisc.ac.in',
          phone: '9888112234',
        },
      ],
    };

    const result = detectTeamDuplicates(input, existingTeamsList);
    expect(result.action).toBe('allow');
    expect(result.reviewStatus).toBe('approved');
  });
});

describe('Store & Admin Duplicate Review Lifecycle', () => {
  let createdTeam: Team;

  beforeEach(async () => {
    createdTeam = await createTeam({
      teamName: `Unique Team ${Date.now()}`,
      college: 'Test College of Engineering',
      track: 'Agritech',
      leader: {
        name: 'Leader One',
        email: `leader.${Date.now()}@test.com`,
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      members: [
        {
          name: 'Member Two',
          email: `member.${Date.now()}@test.com`,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      ],
      reviewStatus: 'flagged_duplicate',
      duplicateNotes: 'Flagged for test verification',
    });
  });

  it('persists review status and duplicate notes correctly on creation', () => {
    expect(createdTeam.review_status).toBe('flagged_duplicate');
    expect(createdTeam.duplicate_notes).toBe('Flagged for test verification');
    expect(createdTeam.canonical_name).toBeDefined();
  });

  it('allows organizers to approve a flagged team', async () => {
    const updated = await updateTeamReviewStatus(createdTeam.id, 'approved', 'Verified legitimate team by organizer');
    expect(updated).not.toBeNull();
    expect(updated?.review_status).toBe('approved');
    expect(updated?.duplicate_notes).toBe('Verified legitimate team by organizer');
  });

  it('revokes QR scans when a team is rejected', async () => {
    await updateTeamReviewStatus(createdTeam.id, 'rejected', 'Duplicate rejected');

    const mealResult = await processMealScan(createdTeam.qr_token, 'lunch');
    expect(mealResult.success).toBe(false);
    expect(mealResult.error_code).toBe('TOKEN_REVOKED');

    const coffeeResult = await processCoffeeScan(createdTeam.qr_token);
    expect(coffeeResult.success).toBe(false);
    expect(coffeeResult.error_code).toBe('TOKEN_REVOKED');

    const regResult = await processRegistration(createdTeam.qr_token, []);
    expect(regResult.success).toBe(false);
    expect(regResult.error_code).toBe('TOKEN_REVOKED');
  });

  it('revokes QR scans when a duplicate team is merged into a primary team', async () => {
    const primaryTeam = await createTeam({
      teamName: `Primary Team ${Date.now()}`,
      college: 'BMSIT',
      track: 'Open Innovation',
      leader: {
        name: 'Primary Leader',
        email: `primary.${Date.now()}@test.com`,
        phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      members: [],
    });

    const mergeResult = await mergeDuplicateTeam(createdTeam.id, primaryTeam.id, 'Merged by admin test');
    expect(mergeResult.success).toBe(true);
    expect(mergeResult.duplicateTeam?.review_status).toBe('merged');
    expect(mergeResult.duplicateTeam?.merged_into_team_id).toBe(primaryTeam.id);

    const mealResult = await processMealScan(createdTeam.qr_token, 'lunch');
    expect(mealResult.success).toBe(false);
    expect(mealResult.error_code).toBe('TEAM_MERGED');
  });

  it('allows editing team details and roster from dashboard', async () => {
    const editResult = await updateTeamDetails(createdTeam.id, {
      teamName: 'Updated Team Innovators',
      college: 'Updated Tech Institute',
      track: 'Cyber-Physical Security & Defense',
      leader: {
        name: 'Leader Updated',
        email: 'leader.updated@test.com',
        phone: '9988112233',
      },
      members: [
        {
          name: 'Member New',
          email: 'member.new@test.com',
          phone: '9988112234',
        },
      ],
    });

    expect(editResult.success).toBe(true);
    expect(editResult.team?.team_name).toBe('Updated Team Innovators');
    expect(editResult.team?.college).toBe('Updated Tech Institute');
    expect(editResult.team?.track).toBe('Cyber-Physical Security & Defense');
    expect(editResult.members?.length).toBe(2);
    expect(editResult.members?.[0].name).toBe('Leader Updated');
  });
});


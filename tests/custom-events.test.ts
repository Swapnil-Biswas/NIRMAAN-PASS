import { describe, it, expect } from 'vitest';
import {
  createTeam,
  getTeamMembers,
  processRegistration,
  getCustomScanEvents,
  createCustomScanEvent,
  deleteCustomScanEvent,
  processCustomScan,
  getCustomScanRecords,
} from '@/lib/data/store';

describe('Custom Scan Events Management & Scanning Rules', () => {
  it('creates, retrieves, and deletes custom scan events', async () => {
    const event = await createCustomScanEvent({
      title: 'Midnight Snack',
      description: 'Hot cocoa & cookies at 1:00 AM',
      limit_rule: 'once_per_team',
      color: '#EC4899',
      icon: 'Moon',
    });

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.title).toBe('MIDNIGHT SNACK');
    expect(event.limit_rule).toBe('once_per_team');

    const allEvents = await getCustomScanEvents();
    const found = allEvents.find((e) => e.id === event.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('MIDNIGHT SNACK');

    // Deletion
    const deleted = await deleteCustomScanEvent(event.id);
    expect(deleted).toBe(true);

    const afterDelete = await getCustomScanEvents();
    expect(afterDelete.find((e) => e.id === event.id)).toBeUndefined();
  });

  it('enforces "once_per_team" rule: allows 1 scan and rejects subsequent scans with ALREADY_COMPLETED', async () => {
    const event = await createCustomScanEvent({
      title: 'Swag Kit Distribution',
      description: 'Welcome kit with hoodie & stickers',
      limit_rule: 'once_per_team',
      color: '#8B5CF6',
      icon: 'Package',
    });

    const team = await createTeam({
      teamName: 'Swag Hunters',
      college: 'Design Tech',
      track: 'Open Innovation',
      leader: { name: 'Alice Leader', email: 'alice@swag.com', phone: '1112223334' },
      members: [{ name: 'Bob Partner', email: 'bob@swag.com', phone: '1112223335' }],
    });

    // Check in the team
    const members = await getTeamMembers(team.id);
    await processRegistration(team.qr_token, [members[0].id, members[1].id]);

    // 1st scan -> success
    const scan1 = await processCustomScan(team.qr_token, event.id);
    expect(scan1.success).toBe(true);
    expect(scan1.new_count).toBe(1);

    // 2nd scan -> rejected
    const scan2 = await processCustomScan(team.qr_token, event.id);
    expect(scan2.success).toBe(false);
    expect(scan2.error_code).toBe('ALREADY_COMPLETED');

    // Verify record exists
    const records = await getCustomScanRecords(event.id);
    const teamRecord = records.find((r) => r.team_id === team.id);
    expect(teamRecord).toBeDefined();
    expect(teamRecord?.count).toBe(1);
  });

  it('enforces "per_present_member" rule: rejects when not checked in, caps at present headcount', async () => {
    const event = await createCustomScanEvent({
      title: 'Hardware Dev Kit',
      description: 'Microcontroller boards per present member',
      limit_rule: 'per_present_member',
      color: '#3B82F6',
      icon: 'Cpu',
    });

    const team = await createTeam({
      teamName: 'Hardware Wizards',
      college: 'Robotics Institute',
      track: 'Cyber-Physical Security & Defense',
      leader: { name: 'Robo Leader', email: 'robo@hw.com', phone: '9998887771' },
      members: [
        { name: 'Sensor Specialist', email: 'sensor@hw.com', phone: '9998887772' },
        { name: 'Circuit Designer', email: 'circuit@hw.com', phone: '9998887773' },
      ],
    });

    // Unregistered team scan -> rejected NOT_CHECKED_IN
    const unregScan = await processCustomScan(team.qr_token, event.id);
    expect(unregScan.success).toBe(false);
    expect(unregScan.error_code).toBe('NOT_CHECKED_IN');

    // Check in 2 out of 3 members
    const members = await getTeamMembers(team.id);
    await processRegistration(team.qr_token, [members[0].id, members[1].id]);

    // Scan 1
    const scan1 = await processCustomScan(team.qr_token, event.id);
    expect(scan1.success).toBe(true);
    expect(scan1.new_count).toBe(1);
    expect(scan1.remaining_count).toBe(1);

    // Scan 2
    const scan2 = await processCustomScan(team.qr_token, event.id);
    expect(scan2.success).toBe(true);
    expect(scan2.new_count).toBe(2);
    expect(scan2.remaining_count).toBe(0);

    // Scan 3 -> rejected LIMIT_REACHED
    const scan3 = await processCustomScan(team.qr_token, event.id);
    expect(scan3.success).toBe(false);
    expect(scan3.error_code).toBe('LIMIT_REACHED');
  });

  it('enforces "unlimited" rule: increments count continuously', async () => {
    const event = await createCustomScanEvent({
      title: 'Mentorship Rounds',
      description: 'Count mentor feedback sessions',
      limit_rule: 'unlimited',
      color: '#10B981',
      icon: 'Award',
    });

    const team = await createTeam({
      teamName: 'Mentee Alpha',
      college: 'Startup Hub',
      track: 'Deep Tech & Edge AI',
      leader: { name: 'Founder One', email: 'f1@startup.com', phone: '5554443331' },
      members: [],
    });

    const res1 = await processCustomScan(team.qr_token, event.id);
    expect(res1.success).toBe(true);
    expect(res1.new_count).toBe(1);

    const res2 = await processCustomScan(team.qr_token, event.id);
    expect(res2.success).toBe(true);
    expect(res2.new_count).toBe(2);

    const res3 = await processCustomScan(team.qr_token, event.id);
    expect(res3.success).toBe(true);
    expect(res3.new_count).toBe(3);
  });

  it('handles non-existent event IDs and invalid tokens gracefully', async () => {
    const fakeScan = await processCustomScan('non_existent_token', 'non_existent_event');
    expect(fakeScan.success).toBe(false);
    expect(fakeScan.error_code).toBe('INVALID_EVENT');

    const event = await createCustomScanEvent({
      title: 'Demo Check',
      description: 'Check',
      limit_rule: 'unlimited',
    });

    const invalidTeamScan = await processCustomScan('invalid_token_999', event.id);
    expect(invalidTeamScan.success).toBe(false);
    expect(invalidTeamScan.error_code).toBe('INVALID_QR');
  });
});

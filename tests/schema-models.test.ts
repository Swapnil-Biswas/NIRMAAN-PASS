import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  Event,
  Registration,
  AttendanceInstance,
  AttendanceRecord,
} from '@/types/database';

describe('Event & Attendance Schema Definitions', () => {
  it('has prisma/schema.prisma with all requested models', () => {
    const prismaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    expect(fs.existsSync(prismaPath)).toBe(true);

    const content = fs.readFileSync(prismaPath, 'utf-8');
    expect(content).toContain('model Registration');
    expect(content).toContain('model AttendanceInstance');
    expect(content).toContain('model AttendanceRecord');
    expect(content).toContain('model Event');
    expect(content).toContain('attendanceCode');
    expect(content).toContain('prerequisiteInstanceId');
    expect(content).toContain('teamMembers');
    expect(content).toContain('@@unique([email, eventId])');
    expect(content).toContain('@@unique([attendanceInstanceId, registrationId, memberEmail])');
  });

  it('has Supabase SQL migration for the new schema', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20260102000000_event_registration_schema.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "Event"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "Registration"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "AttendanceInstance"');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS "AttendanceRecord"');
  });

  it('validates TypeScript interface instantiation and relationships', () => {
    const mockEvent: Event = {
      id: 'evt-1',
      title: 'NIRMAAN 2026',
      date: '2026-09-18T09:00:00.000Z',
      status: 'UPCOMING',
    };

    const mockRegistration: Registration = {
      id: 'reg-1',
      status: 'APPROVED',
      userType: 'STUDENT',
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+91 99999 88888',
      usn: '1BM22CS001',
      semester: 6,
      department: 'CSE',
      section: 'A',
      teamName: 'ByteCrafters',
      teamMembers: [{ name: 'John Doe', email: 'john@example.com' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendanceCode: 'NIRMAAN-ATT-001',
      attended: false,
      eventId: mockEvent.id,
    };

    const deskCheckin: AttendanceInstance = {
      id: 'inst-1',
      eventId: mockEvent.id,
      name: 'Desk Registration',
      createdAt: new Date().toISOString(),
    };

    const lunchSession: AttendanceInstance = {
      id: 'inst-2',
      eventId: mockEvent.id,
      name: 'Day 1 Lunch',
      prerequisiteInstanceId: deskCheckin.id,
      createdAt: new Date().toISOString(),
    };

    const record: AttendanceRecord = {
      id: 'rec-1',
      attendanceInstanceId: deskCheckin.id,
      registrationId: mockRegistration.id,
      memberEmail: mockRegistration.email,
      attendedAt: new Date().toISOString(),
    };

    expect(mockRegistration.eventId).toBe(mockEvent.id);
    expect(lunchSession.prerequisiteInstanceId).toBe(deskCheckin.id);
    expect(record.registrationId).toBe(mockRegistration.id);
    expect(record.memberEmail).toBe(mockRegistration.email);
  });
});

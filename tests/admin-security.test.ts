import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getExpectedAdminCode, getAdminSessionToken, verifyAdminSession, ADMIN_COOKIE_NAME } from '@/lib/auth/admin';
import { POST as authPost, DELETE as authDelete, GET as authGet } from '@/app/api/admin/auth/route';
import { GET as teamsGet } from '@/app/api/admin/teams/route';
import { POST as scanPost } from '@/app/api/admin/scan/route';
import { GET as statsGet } from '@/app/api/admin/stats/route';
import { POST as announcementPost } from '@/app/api/announcements/route';
import seededDataset from '@/lib/data/seeded_teams.json';

describe('Admin Security & Route Protection', () => {
  it('correctly validates admin session helper', () => {
    // Unauthenticated
    const emptyReq = new NextRequest('http://localhost/api/admin/teams');
    expect(verifyAdminSession(emptyReq)).toBe(false);

    // Wrong code in header
    const wrongHeaderReq = new NextRequest('http://localhost/api/admin/teams', {
      headers: { 'x-admin-code': 'wrong_code' },
    });
    expect(verifyAdminSession(wrongHeaderReq)).toBe(false);

    // Correct code in header
    const validHeaderReq = new NextRequest('http://localhost/api/admin/teams', {
      headers: { 'x-admin-code': getExpectedAdminCode() },
    });
    expect(verifyAdminSession(validHeaderReq)).toBe(true);

    // Correct cookie
    const validCookieReq = new NextRequest('http://localhost/api/admin/teams', {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${getAdminSessionToken()}`,
      },
    });
    expect(verifyAdminSession(validCookieReq)).toBe(true);
  });

  it('POST /api/admin/auth rejects invalid codes and accepts correct code', async () => {
    // Invalid code
    const invalidReq = new NextRequest('http://localhost/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ code: 'wrong_secret' }),
    });
    const invalidRes = await authPost(invalidReq);
    expect(invalidRes.status).toBe(401);
    const invalidData = await invalidRes.json();
    expect(invalidData.success).toBe(false);

    // Valid code
    const validReq = new NextRequest('http://localhost/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ code: getExpectedAdminCode() }),
    });
    const validRes = await authPost(validReq);
    expect(validRes.status).toBe(200);
    const validData = await validRes.json();
    expect(validData.success).toBe(true);
    // Should set session cookie
    const setCookie = validRes.headers.get('set-cookie');
    expect(setCookie).toContain(ADMIN_COOKIE_NAME);
  });

  it('protects /api/admin/teams against unauthenticated access', async () => {
    // Unauthenticated
    const unauthReq = new NextRequest('http://localhost/api/admin/teams');
    const unauthRes = await teamsGet(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Authenticated
    const authReq = new NextRequest('http://localhost/api/admin/teams', {
      headers: { 'x-admin-code': getExpectedAdminCode() },
    });
    const authRes = await teamsGet(authReq);
    expect(authRes.status).toBe(200);
    const data = await authRes.json();
    expect(data.success).toBe(true);
    expect(data.teams.length).toBe(289);
  });

  it('protects /api/admin/scan against unauthenticated access', async () => {
    // Unauthenticated scan
    const unauthReq = new NextRequest('http://localhost/api/admin/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_token: 'nirmaan_0xdeadead_036aa8d8a426', purpose: 'coffee' }),
    });
    const unauthRes = await scanPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Authenticated scan
    const authReq = new NextRequest('http://localhost/api/admin/scan', {
      method: 'POST',
      headers: { 'x-admin-code': getExpectedAdminCode() },
      body: JSON.stringify({ qr_token: 'nirmaan_0xdeadead_036aa8d8a426', purpose: 'coffee' }),
    });
    const authRes = await scanPost(authReq);
    expect(authRes.status).toBe(200);
    const data = await authRes.json();
    expect(data.success).toBe(true);
  });

  it('protects /api/admin/stats against unauthenticated access', async () => {
    const unauthReq = new NextRequest('http://localhost/api/admin/stats');
    const unauthRes = await statsGet(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = new NextRequest('http://localhost/api/admin/stats', {
      headers: { 'x-admin-code': getExpectedAdminCode() },
    });
    const authRes = await statsGet(authReq);
    expect(authRes.status).toBe(200);
  });

  it('protects POST /api/announcements against unauthenticated broadcasting', async () => {
    const unauthReq = new NextRequest('http://localhost/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', message: 'Test message' }),
    });
    const unauthRes = await announcementPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = new NextRequest('http://localhost/api/announcements', {
      method: 'POST',
      headers: { 'x-admin-code': getExpectedAdminCode() },
      body: JSON.stringify({ title: 'Test Announcement', message: 'Legitimate announcement' }),
    });
    const authRes = await announcementPost(authReq);
    expect(authRes.status).toBe(201);
  });
});

describe('Dummy Data Absence Verification', () => {
  it('seeded dataset contains exactly 289 teams all starting with 0 counts', () => {
    expect(seededDataset.teams.length).toBe(289);
    for (const team of seededDataset.teams) {
      expect(team.checked_in).toBe(false);
      expect(team.breakfast_count).toBe(0);
      expect(team.lunch_count).toBe(0);
      expect(team.dinner_count).toBe(0);
      expect(team.coffee_count).toBe(0);
    }
  });

  it('seeded dataset contains 908 members all starting with present: false', () => {
    expect(seededDataset.members.length).toBe(908);
    for (const member of seededDataset.members) {
      expect(member.present).toBe(false);
    }
  });

  it('does not contain any fake teams like Team Alpha, Beta, Gamma', () => {
    const names = seededDataset.teams.map((t) => t.team_name.toLowerCase());
    expect(names).not.toContain('team alpha (bytecrafters)');
    expect(names).not.toContain('team beta (neuralknights)');
    expect(names).not.toContain('team gamma (cybervanguard)');
  });
});

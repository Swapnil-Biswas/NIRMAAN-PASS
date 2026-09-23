import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getExpectedAdminCode,
  createAdminSessionToken,
  verifyAdminSession,
  verifyAdminSessionToken,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/admin';
import {
  POST as authPost,
  DELETE as authDelete,
  GET as authGet,
  PUT as authPut,
} from '@/app/api/admin/auth/route';
import { GET as teamsGet } from '@/app/api/admin/teams/route';
import { POST as scanPost } from '@/app/api/admin/scan/route';
import { GET as statsGet } from '@/app/api/admin/stats/route';
import { POST as announcementPost } from '@/app/api/announcements/route';
import seededDataset from '@/lib/data/seeded_teams.json';

describe('Admin Security & Route Protection', () => {
  it('correctly validates admin session helper and cryptographic token', () => {
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

    // Correct HMAC signed cookie
    const token = createAdminSessionToken();
    expect(verifyAdminSessionToken(token)).toBe(true);

    const validCookieReq = new NextRequest('http://localhost/api/admin/teams', {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${token}`,
      },
    });
    expect(verifyAdminSession(validCookieReq)).toBe(true);

    // Tampered token is rejected
    const tamperedToken = token + 'tampered';
    expect(verifyAdminSessionToken(tamperedToken)).toBe(false);
  });

  it('POST /api/admin/auth rejects invalid codes and accepts correct code with secure session cookie', async () => {
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

    // Should set HTTP-only session cookie
    const setCookie = validRes.headers.get('set-cookie');
    expect(setCookie).toContain(ADMIN_COOKIE_NAME);
  });

  it('PUT /api/admin/auth refreshes session token during active usage', async () => {
    const token = createAdminSessionToken();
    const heartbeatReq = new NextRequest('http://localhost/api/admin/auth', {
      method: 'PUT',
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=${token}`,
      },
    });
    const res = await authPut(heartbeatReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(res.headers.get('set-cookie')).toContain(ADMIN_COOKIE_NAME);
  });

  it('DELETE /api/admin/auth revokes the session cookie and locks panel', async () => {
    const res = await authDelete();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=;`);
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
    expect(Array.isArray(data.teams)).toBe(true);
  });

  it('protects /api/admin/scan against unauthenticated access', async () => {
    // Unauthenticated scan
    const unauthReq = new NextRequest('http://localhost/api/admin/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_token: 'test_token_123', purpose: 'coffee' }),
    });
    const unauthRes = await scanPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Authenticated scan
    const authReq = new NextRequest('http://localhost/api/admin/scan', {
      method: 'POST',
      headers: { 'x-admin-code': getExpectedAdminCode() },
      body: JSON.stringify({ qr_token: 'test_token_123', purpose: 'coffee' }),
    });
    const authRes = await scanPost(authReq);
    expect(authRes.status).toBe(400);
    const data = await authRes.json();
    expect(data.success).toBe(false); // Invalid token as expected
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

describe('Official Shortlist Dataset Verification', () => {
  it('seeded dataset contains 50 official hackathon teams', () => {
    expect(seededDataset.teams.length).toBe(50);
  });

  it('seeded dataset contains 184 official team members', () => {
    expect(seededDataset.members.length).toBe(184);
  });

  it('contains valid team leader emails for authentication', () => {
    const leaderEmails = seededDataset.members.filter((m: any) => m.is_leader).map((m: any) => m.email);
    expect(leaderEmails.length).toBe(50);
    expect(leaderEmails).toContain('1nt24cs238.sagar@nmit.ac.in');
    expect(leaderEmails).toContain('vamshikrishms@gmail.com');
  });
});

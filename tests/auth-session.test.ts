import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { GET as sessionGet } from '@/app/api/auth/session/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { createTeam } from '@/lib/data/store';
import { Team } from '@/types/database';

describe('Participant Standalone Auth & Session Management', () => {
  let sampleTeam: Team;
  const sampleEmail = 'chetan_test_auth@college.edu';

  beforeAll(async () => {
    sampleTeam = await createTeam({
      teamName: 'Auth Test Team',
      college: 'BMSIT',
      track: 'Cyber-Physical Security & Defense',
      leader: { name: 'Chetan K', email: sampleEmail, phone: '9876543210' },
      members: [],
    });
  });

  it('POST /api/auth/login rejects empty or invalid email', async () => {
    const emptyReq = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
    });
    const emptyRes = await loginPost(emptyReq);
    expect(emptyRes.status).toBe(400);

    const nonExistentReq = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent_user_99999@example.com' }),
    });
    const nonExistentRes = await loginPost(nonExistentReq);
    expect(nonExistentRes.status).toBe(404);
  });

  it('POST /api/auth/login logs in a registered team member and sets session cookie', async () => {
    const validReq = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: sampleEmail }),
    });
    const validRes = await loginPost(validReq);
    expect(validRes.status).toBe(200);

    const data = await validRes.json();
    expect(data.success).toBe(true);
    expect(data.token).toBe(sampleTeam.qr_token);

    const setCookie = validRes.headers.get('set-cookie');
    expect(setCookie).toContain('nirmaan_team_session');
  });

  it('GET /api/auth/session returns loggedIn: false when unauthenticated', async () => {
    const unauthReq = new NextRequest('http://localhost/api/auth/session');
    const res = await sessionGet(unauthReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loggedIn).toBe(false);
  });

  it('GET /api/auth/session recognizes nirmaan_team_session cookie', async () => {
    const sessionPayload = JSON.stringify({
      teamId: sampleTeam.id,
      email: sampleEmail,
      token: sampleTeam.qr_token,
      team_name: sampleTeam.team_name,
    });

    const authReq = new NextRequest('http://localhost/api/auth/session', {
      headers: {
        cookie: `nirmaan_team_session=${encodeURIComponent(sessionPayload)}`,
      },
    });
    const res = await sessionGet(authReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loggedIn).toBe(true);
    expect(data.email).toBe(sampleEmail);
    expect(data.token).toBe(sampleTeam.qr_token);
  });

  it('POST /api/auth/logout deletes nirmaan_team_session cookie', async () => {
    const logoutReq = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });
    const res = await logoutPost(logoutReq);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('nirmaan_team_session=;');
  });
});

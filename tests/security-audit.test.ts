import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createTeamSessionToken,
  verifyTeamSessionToken,
  TEAM_COOKIE_NAME,
} from '@/lib/auth/session';
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  getExpectedAdminCode,
  safeCompareAdminCode,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth/admin';
import { checkRateLimit, clearAllRateLimits } from '@/lib/security/rateLimit';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as teamUpdatePost } from '@/app/api/team/update/route';
import { POST as adminAuthPost } from '@/app/api/admin/auth/route';
import { POST as scanPost } from '@/app/api/admin/scan/route';
import { POST as activateLinkPost } from '@/app/api/activate/link/route';
import { createTeam, findTeamById } from '@/lib/data/store';
import { middleware } from '@/middleware';
import { Team } from '@/types/database';

describe('Production Security Hardening & Audit Verification', () => {
  let victimTeam: Team;
  let attackerTeam: Team;
  const victimEmail = 'victim.alpha@college.edu';
  const attackerEmail = 'attacker.beta@college.edu';

  beforeAll(async () => {
    clearAllRateLimits();

    victimTeam = await createTeam({
      teamName: 'Victim Team Alpha',
      college: 'BMSIT',
      track: 'Cyber-Physical Security & Defense',
      leader: { name: 'Victim Leader', email: victimEmail, phone: '9988776655' },
      members: [],
    });

    attackerTeam = await createTeam({
      teamName: 'Attacker Team Beta',
      college: 'BMSIT',
      track: 'Deep Tech & Edge AI',
      leader: { name: 'Attacker Leader', email: attackerEmail, phone: '9988776644' },
      members: [],
    });
  });

  describe('1. Cryptographic Session Token Security (HMAC-SHA256)', () => {
    it('creates and verifies a legitimate participant session token', () => {
      const token = createTeamSessionToken({
        teamId: victimTeam.id,
        email: victimEmail,
        token: victimTeam.qr_token,
        team_name: victimTeam.team_name,
      });

      expect(token.startsWith('v1.')).toBe(true);
      const parsed = verifyTeamSessionToken(token);
      expect(parsed).not.toBeNull();
      expect(parsed?.teamId).toBe(victimTeam.id);
      expect(parsed?.email).toBe(victimEmail);
    });

    it('rejects a forged or tampered participant session token', () => {
      const legitToken = createTeamSessionToken({
        teamId: victimTeam.id,
        email: victimEmail,
        token: victimTeam.qr_token,
        team_name: victimTeam.team_name,
      });

      // Modifying signature part
      const parts = legitToken.split('.');
      const tamperedSignature = parts[0] + '.' + parts[1] + '.invalid_signature_bits';
      expect(verifyTeamSessionToken(tamperedSignature)).toBeNull();

      // Modifying payload without valid signature
      const fakePayloadB64 = Buffer.from(
        JSON.stringify({
          teamId: victimTeam.id,
          email: victimEmail,
          token: victimTeam.qr_token,
          team_name: victimTeam.team_name,
          iat: Date.now(),
          exp: Date.now() + 100000,
        })
      ).toString('base64url');
      const forgedToken = `v1.${fakePayloadB64}.fake_sig`;
      expect(verifyTeamSessionToken(forgedToken)).toBeNull();
    });

    it('rejects an expired participant session token', () => {
      const expiredPayload = {
        teamId: victimTeam.id,
        email: victimEmail,
        token: victimTeam.qr_token,
        team_name: victimTeam.team_name,
        iat: Date.now() - 40 * 24 * 60 * 60 * 1000,
        exp: Date.now() - 1000, // expired 1 sec ago
      };

      // Create signed token using expired expiration
      const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const { createHmac } = require('crypto');
      const secret =
        process.env.TEAM_SESSION_SECRET ||
        process.env.ADMIN_SESSION_SECRET ||
        'nirmaan_pass_participant_session_secret_2026';
      const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
      const expiredToken = `v1.${payloadB64}.${sig}`;

      expect(verifyTeamSessionToken(expiredToken)).toBeNull();
    });

    it('creates and verifies legitimate admin session tokens and rejects tampered ones', () => {
      const adminToken = createAdminSessionToken();
      expect(verifyAdminSessionToken(adminToken)).toBe(true);

      const tampered = adminToken + '_corrupt';
      expect(verifyAdminSessionToken(tampered)).toBe(false);
    });

    it('performs timing-safe admin code comparison', () => {
      const validCode = getExpectedAdminCode();
      expect(safeCompareAdminCode(validCode)).toBe(true);
      expect(safeCompareAdminCode('wrong_code')).toBe(false);
      expect(safeCompareAdminCode('')).toBe(false);
      expect(safeCompareAdminCode(undefined)).toBe(false);
    });
  });

  describe('2. Insecure Direct Object References (IDOR) & Authorization Hardening', () => {
    it('prevents an attacker from modifying another team details without authorization', async () => {
      // Attacker is logged in as Attacker Team Beta
      const attackerSessionToken = createTeamSessionToken({
        teamId: attackerTeam.id,
        email: attackerEmail,
        token: attackerTeam.qr_token,
        team_name: attackerTeam.team_name,
      });

      // Attacker attempts to overwrite Victim Team Alpha's data
      const idorReq = new NextRequest('http://localhost/api/team/update', {
        method: 'POST',
        headers: {
          cookie: `${TEAM_COOKIE_NAME}=${attackerSessionToken}`,
        },
        body: JSON.stringify({
          teamId: victimTeam.id, // target victim!
          token: attackerTeam.qr_token,
          teamName: 'Hacked Team Alpha',
          college: 'Malicious College',
          track: 'Open Innovation / Other',
          leader: { name: 'Hacker', email: 'hacker@evil.com', phone: '9999999999' },
          members: [],
        }),
      });

      const res = await teamUpdatePost(idorReq);
      // Must be rejected with 401 Unauthorized
      expect(res.status).toBe(401);

      // Verify victim team is completely unchanged
      const currentVictim = await findTeamById(victimTeam.id);
      expect(currentVictim?.team_name).toBe('Victim Team Alpha');
    });

    it('allows a team leader to update their own team details with valid session', async () => {
      const victimSessionToken = createTeamSessionToken({
        teamId: victimTeam.id,
        email: victimEmail,
        token: victimTeam.qr_token,
        team_name: victimTeam.team_name,
      });

      const legitimateReq = new NextRequest('http://localhost/api/team/update', {
        method: 'POST',
        headers: {
          cookie: `${TEAM_COOKIE_NAME}=${victimSessionToken}`,
        },
        body: JSON.stringify({
          teamId: victimTeam.id,
          token: victimTeam.qr_token,
          teamName: 'Victim Team Alpha Updated',
          college: 'BMSIT',
          track: 'Cyber-Physical Security & Defense',
          leader: { name: 'Victim Leader', email: victimEmail, phone: '9988776655' },
          members: [],
        }),
      });

      const res = await teamUpdatePost(legitimateReq);
      expect(res.status).toBe(200);

      const currentVictim = await findTeamById(victimTeam.id);
      expect(currentVictim?.team_name).toBe('Victim Team Alpha Updated');
    });
  });

  describe('3. Account Claim & Takeover Protection', () => {
    it('rejects claim attempts on an already linked team in /api/activate/link', async () => {
      // First legitimate link
      const legitimateLinkReq = new NextRequest('http://localhost/api/activate/link', {
        method: 'POST',
        body: JSON.stringify({
          email: victimEmail,
          auth_id: 'legitimate_auth_user_123',
        }),
      });
      const legitimateRes = await activateLinkPost(legitimateLinkReq);
      expect(legitimateRes.status).toBe(200);

      // Attempted takeover by attacker with different auth_id
      const takeoverReq = new NextRequest('http://localhost/api/activate/link', {
        method: 'POST',
        body: JSON.stringify({
          email: victimEmail,
          auth_id: 'attacker_auth_user_999',
        }),
      });

      const res = await activateLinkPost(takeoverReq);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('already linked');
    });
  });

  describe('4. Rate Limiting Protection Against Brute Force & DoS', () => {
    it('enforces rate limits accurately on sliding window', () => {
      clearAllRateLimits();
      const testKey = 'test_ip_client';

      // 3 allowed attempts in 10-second window
      const r1 = checkRateLimit(testKey, 3, 10000);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(testKey, 3, 10000);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(testKey, 3, 10000);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th attempt should be blocked
      const r4 = checkRateLimit(testKey, 3, 10000);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });
  });

  describe('5. Security Headers & Defense In Depth', () => {
    it('middleware sets essential security headers on responses', () => {
      const testReq = new NextRequest('http://localhost/dashboard');
      const res = middleware(testReq);

      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Permissions-Policy')).toContain('camera=(self)');
    });
  });
});

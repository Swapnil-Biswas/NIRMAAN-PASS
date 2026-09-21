import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

const ADMIN_COOKIE_NAME = 'nirmaan_admin_session';

// Default inactivity timeout: 15 minutes (in milliseconds)
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// Maximum session lifetime: 4 hours
export const MAX_SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000;

export function getExpectedAdminCode(): string {
  return process.env.ADMIN_ACCESS_CODE || 'NIRMAAN2026_ADMIN';
}

export function getInactivityTimeoutMs(): number {
  const envVal = process.env.ADMIN_INACTIVITY_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_INACTIVITY_TIMEOUT_MS;
}

/**
 * Returns a secure cryptographic secret for HMAC signing
 */
function getSigningSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_ACCESS_CODE ||
    'nirmaan_pass_admin_session_secret_salt_2026'
  );
}

export interface AdminSessionPayload {
  sid: string;
  iat: number;
  exp: number;
}

/**
 * Generate a cryptographically signed, timestamped session token
 */
export function createAdminSessionToken(): string {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    sid: randomUUID(),
    iat: now,
    exp: now + MAX_SESSION_LIFETIME_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');

  return `v1.${payloadB64}.${signature}`;
}

/**
 * Legacy compatibility alias
 */
export function getAdminSessionToken(): string {
  return createAdminSessionToken();
}

/**
 * Validates a signed session token against secret, expiry, and inactivity window
 */
export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    // Backward compatibility for legacy static tokens during migration
    const legacyToken = `admin_session_${Buffer.from(getExpectedAdminCode()).toString('base64')}`;
    return token === legacyToken;
  }

  const [, payloadB64, signature] = parts;

  try {
    const expectedSignature = createHmac('sha256', getSigningSecret())
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
      return false;
    }

    const payload: AdminSessionPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    );

    const now = Date.now();

    // Check absolute expiration
    if (now > payload.exp) {
      return false;
    }

    // Check inactivity window from token creation
    const inactivityLimit = getInactivityTimeoutMs();
    if (now - payload.iat > inactivityLimit) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to safely compare access codes in constant time
 */
export function safeCompareAdminCode(inputCode: string | undefined | null): boolean {
  if (!inputCode || typeof inputCode !== 'string') return false;
  const expected = getExpectedAdminCode();
  const inputBuf = Buffer.from(inputCode);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(inputBuf, expectedBuf);
}

/**
 * Validate incoming request against admin session cookie or header
 */
export function verifyAdminSession(req?: NextRequest): boolean {
  if (req) {
    // 1. Direct header verification with constant-time comparison (for tests and authorized tools)
    const headerCode = req.headers.get('x-admin-code');
    if (headerCode && safeCompareAdminCode(headerCode)) {
      return true;
    }

    // 2. Cookie verification from request
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (cookie && verifyAdminSessionToken(cookie)) {
      return true;
    }
  }

  // 3. Fallback to server cookies() store in Next.js Server Components
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (cookie && verifyAdminSessionToken(cookie)) {
      return true;
    }
  } catch {}

  return false;
}

export { ADMIN_COOKIE_NAME };

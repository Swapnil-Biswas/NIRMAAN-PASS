import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_COOKIE_NAME = 'nirmaan_admin_session';

export function getExpectedAdminCode(): string {
  return process.env.ADMIN_ACCESS_CODE || 'NIRMAAN2026_ADMIN';
}

/**
 * Generate a deterministic verification token for the admin session
 */
export function getAdminSessionToken(): string {
  const code = getExpectedAdminCode();
  // Simple token based on code and secret salt
  return `admin_session_${Buffer.from(code).toString('base64')}`;
}

/**
 * Validate request against admin session cookie or header
 */
export function verifyAdminSession(req?: NextRequest): boolean {
  const expectedToken = getAdminSessionToken();
  const rawCode = getExpectedAdminCode();

  if (req) {
    // Check header
    const headerCode = req.headers.get('x-admin-code');
    if (headerCode && headerCode === rawCode) {
      return true;
    }

    // Check request cookies
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (cookie && (cookie === expectedToken || cookie === rawCode)) {
      return true;
    }
  }

  // Fall back to server cookies() if available
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (cookie && (cookie === expectedToken || cookie === rawCode)) {
      return true;
    }
  } catch {}

  return false;
}

export { ADMIN_COOKIE_NAME };

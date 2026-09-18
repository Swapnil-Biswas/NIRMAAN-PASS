import crypto from 'crypto';

export const QR_PREFIX = 'NIRMAAN-PASS:';

/**
 * Generate a cryptographically secure, non-guessable random QR token
 */
export function generateQRToken(): string {
  // Generate 24 random bytes -> 32 char base64url or 48 hex chars
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Formats a raw token into the standard NIRMAAN-PASS QR payload
 */
export function formatQRPayload(token: string): string {
  const clean = sanitizeQRToken(token);
  return `${QR_PREFIX}${clean}`;
}

/**
 * Strips any prefixes/whitespace from a scanned QR payload to get the raw token
 */
export function sanitizeQRToken(payload: string): string {
  if (!payload) return '';
  let trimmed = payload.trim();
  if (trimmed.toUpperCase().startsWith(QR_PREFIX.toUpperCase())) {
    trimmed = trimmed.substring(QR_PREFIX.length);
  }
  return trimmed.trim();
}

/**
 * Validates whether a token conforms to expected format
 */
export function isValidTokenFormat(token: string): boolean {
  const sanitized = sanitizeQRToken(token);
  return typeof sanitized === 'string' && sanitized.length >= 8 && /^[a-zA-Z0-9_-]+$/.test(sanitized);
}

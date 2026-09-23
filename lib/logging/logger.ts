/**
 * Lightweight, structured production logging for NIRMAAN-PASS.
 * Safe for serverless environments; never logs secrets, cookies, or full session tokens.
 */

export interface LogPayload {
  route: string;
  operation: string;
  success: boolean;
  durationMs?: number;
  teamId?: string;
  teamName?: string;
  eventId?: string;
  mealType?: string;
  errorCode?: string;
  message?: string;
  ip?: string;
}

export function logEvent(payload: LogPayload): void {
  const timestamp = new Date().toISOString();
  const level = payload.success ? 'INFO' : 'WARN';

  const logEntry = {
    timestamp,
    level,
    route: payload.route,
    operation: payload.operation,
    success: payload.success,
    duration_ms: payload.durationMs !== undefined ? Math.round(payload.durationMs * 100) / 100 : undefined,
    team_id: payload.teamId,
    team_name: payload.teamName,
    event_id: payload.eventId,
    meal_type: payload.mealType,
    error_code: payload.errorCode,
    message: payload.message,
    ip: payload.ip,
  };

  if (process.env.NODE_ENV === 'production') {
    // Structured single-line JSON log in production
    console.log(JSON.stringify(logEntry));
  } else {
    // Clean formatted output in development/testing
    const tag = payload.success ? '✓' : '✗';
    console.log(
      `[${timestamp}] [${tag} ${payload.operation}] ${payload.route} - ${payload.message || (payload.success ? 'OK' : 'FAILED')}${
        payload.durationMs ? ` (${Math.round(payload.durationMs)}ms)` : ''
      }`
    );
  }
}

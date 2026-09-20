'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminGate from './AdminGate';

interface AdminSessionGuardProps {
  children: React.ReactNode;
}

// Marker indicating that the current browser tab was unlocked during this tab lifecycle.
// Note: This NEVER contains the admin access code itself.
export const ADMIN_TAB_SESSION_FLAG = 'nirmaan_admin_unlocked';

// Default inactivity timeout: 15 minutes (in ms)
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export default function AdminSessionGuard({ children }: AdminSessionGuardProps) {
  const router = useRouter();
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Immediately lock the admin console and revoke credentials on server
   */
  const lockSession = useCallback(async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_TAB_SESSION_FLAG);
    }
    setIsValidSession(false);

    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {}

    router.refresh();
  }, [router]);

  /**
   * Check session status with server
   */
  const checkSessionStatus = useCallback(async () => {
    // Check if the current browser tab has an active unlock flag
    const hasTabSession = typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_TAB_SESSION_FLAG) === '1';

    if (!hasTabSession) {
      await lockSession();
      return false;
    }

    try {
      const res = await fetch('/api/admin/auth', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data.authenticated) {
        await lockSession();
        return false;
      }

      setIsValidSession(true);
      return true;
    } catch {
      await lockSession();
      return false;
    }
  }, [lockSession]);

  /**
   * Reset inactivity timer on user interaction and send periodic heartbeat
   */
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLast = now - lastActivityRef.current;
    lastActivityRef.current = now;

    // Throttle keepalive heartbeat to once every 2 minutes of active use
    if (timeSinceLast > 2 * 60 * 1000 && isValidSession) {
      fetch('/api/admin/auth', { method: 'PUT', cache: 'no-store' }).catch(() => {});
    }

    // Reset client inactivity countdown
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      // Inactivity timeout exceeded -> lock session immediately
      lockSession();
    }, DEFAULT_TIMEOUT_MS);
  }, [isValidSession, lockSession]);

  useEffect(() => {
    // Initial verification on mount
    checkSessionStatus();

    // Start activity countdown
    inactivityTimerRef.current = setTimeout(() => {
      lockSession();
    }, DEFAULT_TIMEOUT_MS);

    // Periodic heartbeat every 60 seconds to verify session validity
    heartbeatTimerRef.current = setInterval(() => {
      checkSessionStatus();
    }, 60 * 1000);

    // Event listeners for tracking active user interaction
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => handleUserActivity();

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onActivity, { passive: true });
    });

    // Re-verify immediately when tab regains focus or visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed > DEFAULT_TIMEOUT_MS) {
          lockSession();
        } else {
          checkSessionStatus();
        }
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, onActivity);
      });

      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSessionStatus, handleUserActivity, lockSession]);

  // If session is unauthenticated or expired, render the AdminGate unlock screen directly
  if (isValidSession === false) {
    return <AdminGate onUnlocked={() => setIsValidSession(true)} />;
  }

  return <>{children}</>;
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminGate from './AdminGate';

interface AdminSessionGuardProps {
  children: React.ReactNode;
}

export const ADMIN_SESSION_KEY = 'nirmaan_admin_active_tab';

export default function AdminSessionGuard({ children }: AdminSessionGuardProps) {
  const router = useRouter();
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if the current browser tab has an active admin unlock
    const hasActiveSession = typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';

    if (!hasActiveSession) {
      // Invalidate cookie so server also resets
      fetch('/api/admin/auth', { method: 'DELETE' }).finally(() => {
        setIsValidSession(false);
        router.refresh();
      });
    } else {
      setIsValidSession(true);
    }
  }, [router]);

  if (isValidSession === false) {
    return <AdminGate />;
  }

  return <>{children}</>;
}

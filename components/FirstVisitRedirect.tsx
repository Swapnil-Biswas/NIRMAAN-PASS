'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const VISITED_KEY = 'nirmaan_has_visited';

/**
 * Renders nothing — purely handles first-visit redirect logic.
 * On the very first visit (no localStorage flag) → redirects to /register.
 * On every subsequent visit → does nothing, user stays on /.
 */
export default function FirstVisitRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hasVisited = localStorage.getItem(VISITED_KEY);

    if (!hasVisited) {
      // Mark as visited so future opens land on /
      localStorage.setItem(VISITED_KEY, '1');
      router.replace('/register');
    }
  }, [router]);

  return null;
}

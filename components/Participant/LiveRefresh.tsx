'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface LiveRefreshProps {
  intervalMs?: number;
}

export default function LiveRefresh({ intervalMs = 45000 }: LiveRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const triggerRefresh = () => {
    if (isPending) return;
    startTransition(() => {
      router.refresh();
      setLastRefreshed(new Date());
    });
  };

  useEffect(() => {
    // 1. Polling interval only when tab is active/visible
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !isPending) {
        triggerRefresh();
      }
    }, intervalMs);

    // 2. Refresh immediately when window/tab regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [intervalMs, isPending]);

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-nirmaan-black/60 bg-white/70 border border-nirmaan-black/10 px-2.5 py-1 rounded-full shadow-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-nirmaan-green-dark animate-pulse" />
      <span>LIVE</span>
      <button
        onClick={triggerRefresh}
        disabled={isPending}
        title={`Last updated: ${lastRefreshed.toLocaleTimeString()}`}
        className="ml-0.5 hover:text-nirmaan-black transition-colors"
        aria-label="Refresh live data"
      >
        <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin text-nirmaan-blue' : ''}`} />
      </button>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { ScheduleItem } from '@/types/database';

interface TimelineSectionProps {
  initialSchedule: ScheduleItem[];
}

export default function TimelineSection({ initialSchedule }: TimelineSectionProps) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule);

  // Background polling to keep schedule updated in real time
  useEffect(() => {
    let isMounted = true;

    const fetchLiveSchedule = async () => {
      try {
        const res = await fetch('/api/schedule', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.schedule)) {
          setSchedule(data.schedule);
        }
      } catch {
        // Silently preserve cached schedule on network hiccup
      }
    };

    // Fetch immediately on mount to pick up any admin changes
    fetchLiveSchedule();

    const interval = setInterval(fetchLiveSchedule, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="nirmaan-card p-4 sm:p-8 bg-white border border-nirmaan-black/15 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-nirmaan-black/10">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-nirmaan-orange flex-shrink-0" />
          <h2 className="font-display text-sm sm:text-xl font-black uppercase text-nirmaan-black">
            EVENT TIMELINE &amp; SCHEDULE
          </h2>
        </div>
        <span className="text-[10px] sm:text-xs font-black text-nirmaan-black/75 uppercase tracking-wider">
          25-HOUR RUNTIME
        </span>
      </div>

      <div className="space-y-3">
        {schedule.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-nirmaan-black/50 uppercase">
            Schedule is currently being finalized. Check back shortly.
          </div>
        ) : (
          schedule.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all hover:bg-nirmaan-cream/70"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-black text-nirmaan-black bg-white px-2.5 py-1 rounded-lg border border-nirmaan-black/10 shadow-xs flex-shrink-0">
                  {item.time}
                </span>
                <span className="font-bold text-xs sm:text-sm text-nirmaan-black">
                  {item.title}
                </span>
              </div>

              <span
                className={`nirmaan-pill ${item.color} ${
                  item.text_color ||
                  (item.color.includes('amber') || item.color.includes('green-bright')
                    ? 'text-nirmaan-black'
                    : 'text-white')
                } text-[10px] self-start sm:self-auto font-black shadow-2xs`}
              >
                {item.tag}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

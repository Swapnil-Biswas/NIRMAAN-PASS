'use client';

import React from 'react';
import { Megaphone, AlertCircle, Bell, Clock } from 'lucide-react';
import { Announcement, PriorityLevel } from '@/types/database';

interface AnnouncementListProps {
  announcements: Announcement[];
}

export default function AnnouncementList({ announcements }: AnnouncementListProps) {
  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case 'urgent':
        return {
          label: 'URGENT',
          bg: 'bg-nirmaan-red',
          text: 'text-white',
          border: 'border-nirmaan-red',
        };
      case 'important':
        return {
          label: 'IMPORTANT',
          bg: 'bg-nirmaan-amber',
          text: 'text-nirmaan-black',
          border: 'border-nirmaan-amber',
        };
      default:
        return {
          label: 'ANNOUNCEMENT',
          bg: 'bg-nirmaan-blue',
          text: 'text-white',
          border: 'border-nirmaan-blue',
        };
    }
  };

  if (announcements.length === 0) {
    return (
      <div className="nirmaan-card p-6 text-center text-nirmaan-black/60 border border-nirmaan-black/10">
        <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="font-bold text-sm">No announcements at the moment</p>
        <p className="text-xs">Event updates and notifications will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((ann) => {
        const badge = getPriorityBadge(ann.priority);
        const timeAgo = formatTimeAgo(ann.created_at);

        return (
          <div
            key={ann.id}
            className={`nirmaan-card p-4 sm:p-5 bg-white border-l-4 ${badge.border} shadow-sm transition-transform hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className={`nirmaan-pill ${badge.bg} ${badge.text} text-[10px] font-black`}>
                {badge.label}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-nirmaan-black/50">
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
            </div>

            <h4 className="font-display text-sm sm:text-base font-black uppercase text-nirmaan-black mb-1">
              {ann.title}
            </h4>
            <p className="text-xs sm:text-sm font-medium text-nirmaan-black/80 leading-relaxed">
              {ann.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function formatTimeAgo(dateStr: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

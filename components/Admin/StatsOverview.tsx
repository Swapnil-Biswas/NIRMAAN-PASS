'use client';

import React from 'react';
import {
  Users,
  UserCheck,
  Utensils,
  Coffee,
  Sun,
  Moon,
  ShieldCheck,
  Trophy,
  Sparkles,
  Award,
  Layers,
} from 'lucide-react';
import { EventStatistics, ScanEvent, ScanEventRecord } from '@/types/database';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Utensils,
  ShieldCheck,
  Coffee,
  Award,
  Users,
  Sun,
  Moon,
  Layers,
};

interface StatsOverviewProps {
  stats: EventStatistics;
  customEvents?: ScanEvent[];
  customRecords?: ScanEventRecord[];
}

export default function StatsOverview({ stats, customEvents = [], customRecords = [] }: StatsOverviewProps) {
  const activeCustomEvents = customEvents.filter((e) => e.active);

  const baselineCards = [
    {
      title: 'TOTAL TEAMS',
      value: stats.total_teams,
      subtitle: `${stats.checked_in_teams} checked in`,
      icon: Users,
      bg: 'bg-nirmaan-blue',
      textColor: 'text-white',
    },
    {
      title: 'STUDENTS PRESENT',
      value: stats.present_students,
      subtitle: `Out of ${stats.total_students} registered`,
      icon: UserCheck,
      bg: 'bg-nirmaan-green-dark',
      textColor: 'text-white',
    },
    {
      title: 'CHECK-IN RATE',
      value: `${stats.total_teams > 0 ? Math.round((stats.checked_in_teams / stats.total_teams) * 100) : 0}%`,
      subtitle: `${stats.checked_in_teams} of ${stats.total_teams} teams`,
      icon: ShieldCheck,
      bg: 'bg-nirmaan-purple',
      textColor: 'text-white',
    },
    {
      title: 'COFFEE / TEA CUPS',
      value: stats.total_coffee,
      subtitle: `Limit: 900 cups total (${Math.max(0, 900 - stats.total_coffee)} remaining)`,
      icon: Coffee,
      bg: 'bg-nirmaan-amber',
      textColor: 'text-nirmaan-black',
    },
    {
      title: 'BREAKFAST SERVED',
      value: stats.breakfast_served,
      subtitle: `Limit: ${stats.present_students} present`,
      icon: Sun,
      bg: 'bg-nirmaan-cream-card',
      textColor: 'text-nirmaan-black',
      border: true,
    },
    {
      title: 'LUNCH SERVED',
      value: stats.lunch_served,
      subtitle: `Limit: ${stats.present_students} present`,
      icon: Utensils,
      bg: 'bg-nirmaan-cream-card',
      textColor: 'text-nirmaan-black',
      border: true,
    },
    {
      title: 'DINNER SERVED',
      value: stats.dinner_served,
      subtitle: `Limit: ${stats.present_students} present`,
      icon: Moon,
      bg: 'bg-nirmaan-cream-card',
      textColor: 'text-nirmaan-black',
      border: true,
    },
    {
      title: 'TOTAL FOOD MEALS',
      value: stats.breakfast_served + stats.lunch_served + stats.dinner_served,
      subtitle: 'Sum of all meals served',
      icon: Trophy,
      bg: 'bg-nirmaan-black',
      textColor: 'text-white',
    },
  ];

  const customCards = activeCustomEvents.map((evt) => {
    const eventRecords = customRecords.filter((r) => r.event_id === evt.id);
    const totalCount = eventRecords.reduce((acc, r) => acc + r.count, 0);
    const uniqueTeams = new Set(eventRecords.map((r) => r.team_id)).size;

    let subtitle = `${totalCount} total scans recorded`;
    if (evt.limit_rule === 'once_per_team') {
      subtitle = `${uniqueTeams} of ${stats.checked_in_teams} checked-in teams completed`;
    } else if (evt.limit_rule === 'per_present_member') {
      subtitle = `${totalCount} served (Limit: ${stats.present_students} present)`;
    }

    const Icon = (evt.icon && ICON_MAP[evt.icon]) || Sparkles;

    return {
      title: evt.title,
      value: totalCount,
      subtitle,
      icon: Icon,
      bg: evt.color || 'bg-nirmaan-amber',
      textColor: evt.text_color || (evt.color?.includes('blue') || evt.color?.includes('purple') || evt.color?.includes('dark') || evt.color?.includes('red') ? 'text-white' : 'text-nirmaan-black'),
      border: false,
    };
  });

  const allCards = [...baselineCards, ...customCards];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {allCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`nirmaan-card p-3 sm:p-5 flex flex-col justify-between ${card.bg} ${card.textColor} ${
                card.border ? 'border border-nirmaan-black/10' : 'shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <span className="text-[10px] sm:text-[11px] font-display font-black tracking-wider uppercase opacity-80 truncate max-w-[170px]" title={card.title}>
                  {card.title}
                </span>
                <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4 opacity-75 flex-shrink-0" />
              </div>

              <div className="my-1">
                <span className="font-display text-2xl sm:text-4xl font-black">
                  {card.value}
                </span>
              </div>

              <p className="text-[10px] sm:text-[11px] font-medium opacity-75 mt-0.5 sm:mt-1 truncate" title={card.subtitle}>
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

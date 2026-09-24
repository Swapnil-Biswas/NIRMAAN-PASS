'use client';

import React from 'react';
import { Users, UserCheck, Utensils, Coffee, Sun, Moon, ShieldCheck, Trophy } from 'lucide-react';
import { EventStatistics } from '@/types/database';

interface StatsOverviewProps {
  stats: EventStatistics;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  const statCards = [
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {statCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`nirmaan-card p-3 sm:p-5 flex flex-col justify-between ${card.bg} ${card.textColor} ${card.border ? 'border border-nirmaan-black/10' : 'shadow-md'
              }`}
          >
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <span className="text-[10px] sm:text-[11px] font-display font-black tracking-wider uppercase opacity-80">
                {card.title}
              </span>
              <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4 opacity-75 flex-shrink-0" />
            </div>

            <div className="my-1">
              <span className="font-display text-2xl sm:text-4xl font-black">
                {card.value}
              </span>
            </div>

            <p className="text-[10px] sm:text-[11px] font-medium opacity-75 mt-0.5 sm:mt-1">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}

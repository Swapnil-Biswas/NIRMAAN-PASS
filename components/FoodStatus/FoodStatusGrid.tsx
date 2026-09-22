'use client';

import React from 'react';
import { Utensils, Coffee, Sun, Moon, Sparkles, CheckCircle2 } from 'lucide-react';
import { Team, Member } from '@/types/database';

interface FoodStatusGridProps {
  team: Team;
  members: Member[];
}

export default function FoodStatusGrid({ team, members }: FoodStatusGridProps) {
  const presentCount = members.filter((m) => m.present).length;
  const maxMeals = team.checked_in ? presentCount : members.length;

  const mealItems = [
    {
      title: 'BREAKFAST',
      icon: Sun,
      color: 'bg-nirmaan-amber',
      textColor: 'text-nirmaan-black',
      count: team.breakfast_count,
      max: maxMeals,
      completed: team.checked_in && maxMeals > 0 && team.breakfast_count >= maxMeals,
    },
    {
      title: 'LUNCH',
      icon: Utensils,
      color: 'bg-nirmaan-orange',
      textColor: 'text-white',
      count: team.lunch_count,
      max: maxMeals,
      completed: team.checked_in && maxMeals > 0 && team.lunch_count >= maxMeals,
    },
    {
      title: 'DINNER',
      icon: Moon,
      color: 'bg-nirmaan-purple',
      textColor: 'text-white',
      count: team.dinner_count,
      max: maxMeals,
      completed: team.checked_in && maxMeals > 0 && team.dinner_count >= maxMeals,
    },
    {
      title: 'COFFEE / TEA',
      icon: Coffee,
      color: 'bg-nirmaan-blue',
      textColor: 'text-white',
      count: team.coffee_count,
      max: null, // Unlimited
      completed: false,
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-display text-base sm:text-xl font-bold uppercase text-nirmaan-black flex items-center gap-1.5 sm:gap-2">
          MEAL &amp; BEVERAGE STATUS
        </h3>
        {team.checked_in ? (
          <span className="text-[11px] sm:text-xs font-bold uppercase text-nirmaan-black/70 bg-nirmaan-black/5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
            Entitlement: {presentCount} Present
          </span>
        ) : (
          <span className="text-[11px] sm:text-xs font-bold uppercase text-nirmaan-amber bg-nirmaan-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
            Pending Registration
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {mealItems.map((item, idx) => {
          const Icon = item.icon;
          const percentage = item.max && item.max > 0 ? Math.min(100, Math.round((item.count / item.max) * 100)) : 0;

          return (
            <div
              key={idx}
              className="nirmaan-card p-3 sm:p-5 flex flex-col justify-between relative overflow-hidden border border-nirmaan-black/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-display font-black tracking-wider text-nirmaan-black/80">
                  {item.title}
                </span>
                <div className={`p-1.5 sm:p-2 rounded-xl ${item.color} ${item.textColor} flex-shrink-0`}>
                  <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </div>
              </div>

              {/* Big Stat Number */}
              <div className="my-1 sm:my-2">
                <div className="font-display text-2xl sm:text-4xl font-black text-nirmaan-black flex flex-wrap items-baseline gap-1">
                  <span>{item.count}</span>
                  {item.max !== null ? (
                    <span className="text-sm sm:text-xl font-bold text-nirmaan-black/40">
                      / {item.max}
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-xs font-bold uppercase text-nirmaan-blue bg-nirmaan-blue/10 px-1.5 sm:px-2 py-0.5 rounded-full">
                      UNLIMITED
                    </span>
                  )}
                </div>

                <p className="text-[10px] sm:text-[11px] font-semibold text-nirmaan-black/60 mt-1">
                  {item.max !== null
                    ? item.completed
                      ? 'All servings claimed'
                      : `${Math.max(0, item.max - item.count)} remaining`
                    : 'Refills anytime at counter'}
                </p>
              </div>

              {/* Progress Bar for Meals */}
              {item.max !== null && (
                <div className="w-full bg-nirmaan-black/10 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      item.completed ? 'bg-nirmaan-green-bright' : item.color
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

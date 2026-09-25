'use client';

import React from 'react';
import { Utensils, Sun, Moon, CheckCircle2, AlertTriangle, X, ShieldAlert, Lock } from 'lucide-react';
import { Team, Member, MealType } from '@/types/database';

// ─── MEAL LOCKS ───────────────────────────────────────────────────────────────
// Keep in sync with ScannerModal.tsx. Set to true to block serving.
// Only BREAKFAST and COFFEE are open.
const LUNCH_LOCKED  = true;
const DINNER_LOCKED = true;

interface MealServeModalProps {
  team: Team;
  members: Member[];
  mealType: MealType;
  onConfirmServe: () => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function MealServeModal({
  team,
  members,
  mealType,
  onConfirmServe,
  onCancel,
  loading,
}: MealServeModalProps) {
  const presentCount = members.filter((m) => m.present).length;
  const currentCount =
    mealType === 'breakfast'
      ? team.breakfast_count
      : mealType === 'lunch'
      ? team.lunch_count
      : team.dinner_count;

  const isCheckedIn = team.checked_in;
  const isMealLocked =
    (LUNCH_LOCKED  && mealType === 'lunch') ||
    (DINNER_LOCKED && mealType === 'dinner');
  const isLimitReached = !isMealLocked && isCheckedIn && presentCount > 0 && currentCount >= presentCount;
  const isZeroPresent  = !isMealLocked && isCheckedIn && presentCount === 0;
  const lockedMealName = mealType === 'lunch' ? 'LUNCH' : 'DINNER';

  const getMealTheme = () => {
    switch (mealType) {
      case 'breakfast':
        return { name: 'BREAKFAST', bg: 'bg-nirmaan-amber', icon: Sun, text: 'text-nirmaan-black' };
      case 'lunch':
        return { name: 'LUNCH', bg: 'bg-nirmaan-orange', icon: Utensils, text: 'text-white' };
      case 'dinner':
        return { name: 'DINNER', bg: 'bg-nirmaan-purple', icon: Moon, text: 'text-white' };
    }
  };

  const theme = getMealTheme();
  const Icon = theme.icon;

  return (
    <div className="fixed inset-0 z-50 bg-nirmaan-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-nirmaan-cream-card rounded-2xl border-2 border-nirmaan-black max-w-md w-full p-4 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className={`nirmaan-pill ${theme.bg} ${theme.text} text-[10px] sm:text-[11px] mb-1.5 sm:mb-2 font-black`}>
              <Icon className="w-3.5 h-3.5" />
              {theme.name} COUNTER
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-nirmaan-black leading-tight break-words">
              {team.team_name}
            </h2>
            <p className="text-xs font-semibold text-nirmaan-black/70">
              {team.college}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-nirmaan-black/10 text-nirmaan-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* State Validation Card */}
        {isMealLocked ? (
          <div className="bg-nirmaan-purple/10 border-2 border-nirmaan-purple p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-purple font-bold text-sm mb-1">
              <Lock className="w-5 h-5" />
              {lockedMealName} CLOSED
            </div>
            <p className="text-xs text-nirmaan-black font-medium leading-relaxed">
              {lockedMealName === 'LUNCH' ? 'Lunch' : 'Dinner'} service has ended. No further entries are allowed.
            </p>
          </div>
        ) : !isCheckedIn ? (
          <div className="bg-nirmaan-red/10 border-2 border-nirmaan-red p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-red font-bold text-sm mb-1">
              <ShieldAlert className="w-5 h-5" />
              REGISTRATION REQUIRED
            </div>
            <p className="text-xs text-nirmaan-black font-medium leading-relaxed">
              Team has not completed On-Desk Registration. Please direct the team to the Registration Desk before serving food.
            </p>
          </div>
        ) : isZeroPresent ? (
          <div className="bg-nirmaan-amber/15 border-2 border-nirmaan-amber p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-black font-bold text-sm mb-1">
              <AlertTriangle className="w-5 h-5 text-nirmaan-orange" />
              NO PRESENT MEMBERS
            </div>
            <p className="text-xs text-nirmaan-black font-medium">
              0 members marked present. Please have attendance updated at the registration desk.
            </p>
          </div>
        ) : isLimitReached ? (
          <div className="bg-nirmaan-red/10 border-2 border-nirmaan-red p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-red font-bold text-sm mb-1">
              <AlertTriangle className="w-5 h-5" />
              MEAL LIMIT REACHED
            </div>
            <p className="text-sm font-black text-nirmaan-black">
              {currentCount} / {presentCount} servings already claimed.
            </p>
            <p className="text-xs text-nirmaan-black/70 mt-1">
              All present team members have received their meal.
            </p>
          </div>
        ) : (
          <div className="bg-nirmaan-cream p-5 rounded-2xl border border-nirmaan-black/10 mb-6 text-center">
            <p className="text-xs font-bold uppercase text-nirmaan-black/60 tracking-wider">
              CURRENT ENTITLEMENT
            </p>
            <div className="my-2 font-display text-4xl font-black text-nirmaan-black flex items-center justify-center gap-2">
              <span className="text-nirmaan-green-dark">{currentCount}</span>
              <span className="text-nirmaan-black/30">/</span>
              <span>{presentCount}</span>
            </div>
            <p className="text-xs font-bold uppercase text-nirmaan-black/70 bg-white inline-block px-3 py-1 rounded-full border border-nirmaan-black/10">
              {presentCount - currentCount} serving(s) remaining
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="nirmaan-btn nirmaan-btn-outline w-1/3 text-xs py-3.5"
          >
            CANCEL
          </button>

          {isMealLocked || !isCheckedIn || isLimitReached || isZeroPresent ? (
            <button
              onClick={onCancel}
              className="nirmaan-btn nirmaan-btn-dark w-2/3 text-xs py-3.5 font-extrabold"
            >
              DISMISS
            </button>
          ) : (
            <button
              onClick={onConfirmServe}
              disabled={loading}
              className={`nirmaan-btn ${theme.bg} ${theme.text} w-2/3 text-xs py-3.5 font-black shadow-lg hover:brightness-95`}
            >
              {loading ? (
                'RECORDING...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="sm:hidden">SERVE (+1)</span>
                  <span className="hidden sm:inline">SERVE {theme.name} (+1)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

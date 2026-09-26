'use client';

import React, { useState } from 'react';
import { Utensils, Sun, Moon, CheckCircle2, X, ShieldAlert, Lock, Check } from 'lucide-react';
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
  onConfirmServe: (count: number) => Promise<void>;
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
  const presentMembers = members.filter((m) => m.present);
  const presentCount   = presentMembers.length;

  const currentCount =
    mealType === 'breakfast'
      ? team.breakfast_count
      : mealType === 'lunch'
      ? team.lunch_count
      : team.dinner_count;

  const isCheckedIn  = team.checked_in;
  const isMealLocked =
    (LUNCH_LOCKED  && mealType === 'lunch') ||
    (DINNER_LOCKED && mealType === 'dinner');

  const lockedMealName = mealType === 'lunch' ? 'LUNCH' : 'DINNER';

  // Member picker state — pre-select members who haven't had this meal yet
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    presentMembers.map((m) => m.id)
  );

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll  = () => setSelectedIds(presentMembers.map((m) => m.id));
  const clearAll   = () => setSelectedIds([]);

  const getMealTheme = () => {
    switch (mealType) {
      case 'breakfast':
        return { name: 'BREAKFAST', bg: 'bg-nirmaan-amber', icon: Sun,      text: 'text-nirmaan-black' };
      case 'lunch':
        return { name: 'LUNCH',     bg: 'bg-nirmaan-orange', icon: Utensils, text: 'text-white' };
      case 'dinner':
        return { name: 'DINNER',    bg: 'bg-nirmaan-purple', icon: Moon,     text: 'text-white' };
    }
  };

  const theme = getMealTheme();
  const Icon  = theme.icon;

  const remaining        = Math.max(0, presentCount - currentCount);
  const serveCount       = selectedIds.length;
  const canServe         = !isMealLocked && isCheckedIn && presentCount > 0 && remaining > 0 && serveCount > 0;

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

        {/* ── LOCKED STATE ── */}
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
          /* ── NOT CHECKED IN ── */
          <div className="bg-nirmaan-red/10 border-2 border-nirmaan-red p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-red font-bold text-sm mb-1">
              <ShieldAlert className="w-5 h-5" />
              REGISTRATION REQUIRED
            </div>
            <p className="text-xs text-nirmaan-black font-medium leading-relaxed">
              Team has not completed On-Desk Registration. Please direct them to the Registration Desk before serving food.
            </p>
          </div>
        ) : presentCount === 0 ? (
          /* ── NO PRESENT MEMBERS ── */
          <div className="bg-nirmaan-amber/15 border-2 border-nirmaan-amber p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-black font-bold text-sm mb-1">
              <ShieldAlert className="w-5 h-5 text-nirmaan-orange" />
              NO PRESENT MEMBERS
            </div>
            <p className="text-xs text-nirmaan-black font-medium">
              0 members marked present. Please update attendance at the Registration Desk.
            </p>
          </div>
        ) : remaining === 0 ? (
          /* ── ALL SERVED ── */
          <div className="bg-nirmaan-red/10 border-2 border-nirmaan-red p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-2 text-nirmaan-red font-bold text-sm mb-1">
              <CheckCircle2 className="w-5 h-5" />
              MEAL LIMIT REACHED
            </div>
            <p className="text-sm font-black text-nirmaan-black">
              {currentCount} / {presentCount} servings already claimed.
            </p>
            <p className="text-xs text-nirmaan-black/70 mt-1">
              All present members have received their meal.
            </p>
          </div>
        ) : (
          /* ── MEMBER PICKER ── */
          <>
            {/* Summary bar */}
            <div className="bg-nirmaan-cream p-4 rounded-2xl border border-nirmaan-black/10 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-nirmaan-black/60">SERVING NOW</p>
                <p className="font-display text-2xl font-black text-nirmaan-black">
                  {serveCount} <span className="text-sm font-bold text-nirmaan-black/50">of {remaining} remaining</span>
                </p>
                <p className="text-[11px] text-nirmaan-black/50 font-medium">
                  {currentCount}/{presentCount} already served
                </p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button
                  onClick={selectAll}
                  type="button"
                  className="text-xs font-bold text-nirmaan-blue hover:underline"
                >
                  All Present
                </button>
                <button
                  onClick={clearAll}
                  type="button"
                  className="text-xs font-bold text-nirmaan-red hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Member checklist — only present members shown */}
            <div className="mb-5 max-h-52 overflow-y-auto space-y-2 pr-1">
              {presentMembers.map((member) => {
                const isSelected = selectedIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-nirmaan-black shadow-sm'
                        : 'bg-nirmaan-cream/50 border-nirmaan-black/10 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-bold text-sm text-nirmaan-black truncate">{member.name}</p>
                      <p className="text-xs text-nirmaan-black/60 truncate">{member.phone}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected
                          ? 'bg-nirmaan-green-bright border-nirmaan-black text-nirmaan-black'
                          : 'border-nirmaan-black/30 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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

          {canServe ? (
            <button
              onClick={() => onConfirmServe(serveCount)}
              disabled={loading || serveCount === 0}
              className={`nirmaan-btn ${theme.bg} ${theme.text} w-2/3 text-xs py-3.5 font-black shadow-lg hover:brightness-95 disabled:opacity-50`}
            >
              {loading ? (
                'RECORDING...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>SERVE {serveCount} {serveCount === 1 ? 'PERSON' : 'PEOPLE'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="nirmaan-btn nirmaan-btn-dark w-2/3 text-xs py-3.5 font-extrabold"
            >
              DISMISS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

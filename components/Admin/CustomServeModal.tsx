'use client';

import React, { useState } from 'react';
import { Sparkles, Utensils, ShieldCheck, Coffee, Award, Users, CheckCircle2, AlertTriangle, X, ShieldAlert, Plus, Minus } from 'lucide-react';
import { Team, Member, ScanEvent, ScanEventRecord } from '@/types/database';

interface CustomServeModalProps {
  team: Team;
  members: Member[];
  event: ScanEvent;
  existingRecords?: ScanEventRecord[];
  onConfirmServe: (count: number) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Utensils,
  ShieldCheck,
  Coffee,
  Award,
  Users,
};

export default function CustomServeModal({
  team,
  members,
  event,
  existingRecords = [],
  onConfirmServe,
  onCancel,
  loading,
}: CustomServeModalProps) {
  const presentCount = members.filter((m) => m.present).length;
  const currentCount = existingRecords.reduce((acc, r) => acc + r.count, 0);

  const [requestedCount, setRequestedCount] = useState(1);

  const isCheckedIn = team.checked_in;
  const isOncePerTeam = event.limit_rule === 'once_per_team';
  const isPerMember = event.limit_rule === 'per_present_member';
  const isUnlimited = event.limit_rule === 'unlimited';

  const alreadyCheckedIn = isOncePerTeam && existingRecords.length > 0;
  const remainingEntitlement = isPerMember ? Math.max(0, presentCount - currentCount) : 999;
  const isLimitReached = isPerMember && isCheckedIn && (currentCount >= presentCount || remainingEntitlement <= 0);
  const isZeroPresent = isPerMember && isCheckedIn && presentCount === 0;

  const IconComponent = (event.icon && ICON_MAP[event.icon]) || Sparkles;

  const handleIncrement = () => {
    if (isPerMember && requestedCount >= remainingEntitlement) return;
    setRequestedCount((c) => c + 1);
  };

  const handleDecrement = () => {
    if (requestedCount <= 1) return;
    setRequestedCount((c) => c - 1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-nirmaan-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-nirmaan-cream-card rounded-2xl border-2 border-nirmaan-black max-w-md w-full p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-nirmaan-black/10 pb-3">
          <div>
            <span className={`nirmaan-pill ${event.color || 'bg-nirmaan-amber'} ${event.text_color || 'text-nirmaan-black'} text-[10px] sm:text-[11px] mb-1.5 font-black uppercase`}>
              <IconComponent className="w-3.5 h-3.5" />
              {event.title}
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
            className="p-1.5 rounded-full hover:bg-nirmaan-black/10 text-nirmaan-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning States */}
        {isPerMember && !isCheckedIn ? (
          <div className="bg-nirmaan-amber/20 border-2 border-nirmaan-amber p-4 rounded-xl flex items-start gap-3 text-nirmaan-black">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-nirmaan-black mt-0.5" />
            <div>
              <p className="font-bold text-xs uppercase">ON-DESK CHECK-IN REQUIRED</p>
              <p className="text-xs text-nirmaan-black/80 mt-1">
                This team has not completed On-Desk Registration yet. Switch mode to <strong>[REGISTRATION]</strong> to verify attending members first.
              </p>
            </div>
          </div>
        ) : isOncePerTeam && alreadyCheckedIn ? (
          <div className="bg-nirmaan-amber/20 border-2 border-nirmaan-amber p-4 rounded-xl flex items-start gap-3 text-nirmaan-black">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-nirmaan-black mt-0.5" />
            <div>
              <p className="font-bold text-xs uppercase">ALREADY CHECKED IN</p>
              <p className="text-xs text-nirmaan-black/80 mt-1">
                Team &quot;{team.team_name}&quot; has already completed their 1-time check-in for this event.
              </p>
            </div>
          </div>
        ) : isLimitReached ? (
          <div className="bg-nirmaan-red/15 border-2 border-nirmaan-red p-4 rounded-xl flex items-start gap-3 text-nirmaan-red">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-nirmaan-red mt-0.5" />
            <div>
              <p className="font-bold text-xs uppercase">MAXIMUM ENTITLEMENT REACHED</p>
              <p className="text-xs text-nirmaan-black/80 mt-1">
                All {presentCount} present team members have already received their entitlement for this event.
              </p>
            </div>
          </div>
        ) : isZeroPresent ? (
          <div className="bg-nirmaan-red/15 border-2 border-nirmaan-red p-4 rounded-xl flex items-start gap-3 text-nirmaan-red">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-nirmaan-red mt-0.5" />
            <div>
              <p className="font-bold text-xs uppercase">ZERO MEMBERS PRESENT</p>
              <p className="text-xs text-nirmaan-black/80 mt-1">
                No team members were marked present during On-Desk Registration.
              </p>
            </div>
          </div>
        ) : null}

        {/* Counter Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-xl border border-nirmaan-black/10">
            <span className="text-[10px] font-bold uppercase text-nirmaan-black/50 block">
              {isOncePerTeam ? 'STATUS' : 'PREVIOUS SERVED'}
            </span>
            <span className="font-display text-xl font-black text-nirmaan-black">
              {isOncePerTeam ? (alreadyCheckedIn ? 'CHECKED IN' : 'PENDING') : `${currentCount} units`}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-nirmaan-black/10">
            <span className="text-[10px] font-bold uppercase text-nirmaan-black/50 block">
              {isPerMember ? 'REMAINING LIMIT' : isOncePerTeam ? 'RULE' : 'ALLOWANCE'}
            </span>
            <span className="font-display text-xl font-black text-nirmaan-blue">
              {isPerMember
                ? `${remainingEntitlement} of ${presentCount}`
                : isOncePerTeam
                ? '1 Per Team'
                : 'Unlimited'}
            </span>
          </div>
        </div>

        {/* Quantity Selector for counter/per_member events */}
        {!isOncePerTeam && !isLimitReached && (!isPerMember || isCheckedIn) && (
          <div className="p-3.5 bg-white rounded-xl border border-nirmaan-black/15 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-nirmaan-black/70">
              Quantity to Record:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={requestedCount <= 1}
                className="w-8 h-8 rounded-lg bg-nirmaan-cream border border-nirmaan-black/20 flex items-center justify-center font-bold text-base disabled:opacity-40"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-display text-lg font-black w-8 text-center">
                {requestedCount}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={isPerMember && requestedCount >= remainingEntitlement}
                className="w-8 h-8 rounded-lg bg-nirmaan-cream border border-nirmaan-black/20 flex items-center justify-center font-bold text-base disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Member Roster List */}
        <div className="space-y-1 pt-1">
          <p className="text-[11px] font-bold uppercase text-nirmaan-black/60">
            Team Members ({presentCount}/{members.length} Present):
          </p>
          <div className="bg-white rounded-xl border border-nirmaan-black/10 divide-y divide-nirmaan-black/5 max-h-36 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="p-2 px-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-nirmaan-black">{m.name}</span>
                {m.present ? (
                  <span className="text-[10px] font-bold text-nirmaan-green-dark bg-nirmaan-green-bright/20 px-2 py-0.5 rounded-full">
                    Present
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-nirmaan-black/40">
                    Not Checked In
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          {(!isPerMember || isCheckedIn) && !alreadyCheckedIn && !isLimitReached && !isZeroPresent ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => onConfirmServe(isOncePerTeam ? 1 : requestedCount)}
              className="w-full nirmaan-btn nirmaan-btn-primary py-3.5 text-xs font-black shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? 'RECORDING...'
                  : isOncePerTeam
                  ? 'CONFIRM CHECK-IN'
                  : `RECORD ${requestedCount} ${requestedCount === 1 ? 'UNIT' : 'UNITS'}`}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onCancel}
            className="w-full nirmaan-btn nirmaan-btn-outline py-2.5 text-xs font-bold"
          >
            CANCEL / CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

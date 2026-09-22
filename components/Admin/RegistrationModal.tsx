'use client';

import React, { useState } from 'react';
import { Check, UserCheck, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { Team, Member } from '@/types/database';

interface RegistrationModalProps {
  team: Team;
  members: Member[];
  onConfirm: (presentMemberIds: string[]) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function RegistrationModal({
  team,
  members,
  onConfirm,
  onCancel,
  loading,
}: RegistrationModalProps) {
  // Initialize checked state with currently present members (or all by default if fresh)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    const present = members.filter((m) => m.present).map((m) => m.id);
    return present.length > 0 ? present : members.map((m) => m.id);
  });

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedMemberIds(members.map((m) => m.id));
  };

  const deselectAll = () => {
    setSelectedMemberIds([]);
  };

  const handleSave = async () => {
    await onConfirm(selectedMemberIds);
  };

  return (
    <div className="fixed inset-0 z-50 bg-nirmaan-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-nirmaan-cream-card rounded-2xl border-2 border-nirmaan-black max-w-lg w-full p-4 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] sm:text-[11px] mb-1.5 sm:mb-2 font-black">
              ON-DESK REGISTRATION
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

        {/* Presence Counter Summary */}
        <div className="bg-nirmaan-cream p-4 rounded-2xl border border-nirmaan-black/10 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-nirmaan-black/60">
              PHYSICAL ATTENDANCE
            </p>
            <p className="font-display text-2xl font-black text-nirmaan-black">
              Present: {selectedMemberIds.length} / {members.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              type="button"
              className="text-xs font-bold text-nirmaan-blue hover:underline"
            >
              All Present
            </button>
            <span className="text-nirmaan-black/30">|</span>
            <button
              onClick={deselectAll}
              type="button"
              className="text-xs font-bold text-nirmaan-red hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Member Checklist */}
        <div className="mb-6 max-h-60 overflow-y-auto space-y-2 pr-1">
          {members.length === 0 ? (
            <p className="text-sm font-semibold text-nirmaan-black/60 text-center py-4">
              No members entered yet for this team.
            </p>
          ) : (
            members.map((member) => {
              const isChecked = selectedMemberIds.includes(member.id);
              return (
                <div
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-white border-nirmaan-black shadow-sm'
                      : 'bg-nirmaan-cream/50 border-nirmaan-black/10 opacity-70'
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm text-nirmaan-black">
                      {member.name}
                    </p>
                    <p className="text-xs text-nirmaan-black/60">
                      {member.phone} • {member.email}
                    </p>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-nirmaan-green-bright border-nirmaan-black text-nirmaan-black'
                        : 'border-nirmaan-black/30 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="nirmaan-btn nirmaan-btn-outline w-1/3 text-xs py-3 cursor-pointer"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="nirmaan-btn nirmaan-btn-primary w-2/3 text-xs py-3 font-extrabold shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              'SAVING...'
            ) : team.checked_in ? (
              <>
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <span className="sm:hidden">UPDATE</span>
                <span className="hidden sm:inline">UPDATE ATTENDANCE</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="sm:hidden">CONFIRM</span>
                <span className="hidden sm:inline">CONFIRM REGISTRATION</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

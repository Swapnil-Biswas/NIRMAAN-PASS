'use client';

import React from 'react';
import { Coffee, CheckCircle2, X } from 'lucide-react';
import { Team } from '@/types/database';

interface CoffeeServeModalProps {
  team: Team;
  onConfirmServe: () => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function CoffeeServeModal({
  team,
  onConfirmServe,
  onCancel,
  loading,
}: CoffeeServeModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-nirmaan-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-nirmaan-cream-card rounded-2xl border-2 border-nirmaan-black max-w-md w-full p-4 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className="nirmaan-pill bg-nirmaan-blue text-white text-[10px] sm:text-[11px] mb-1.5 sm:mb-2 font-black">
              <Coffee className="w-3.5 h-3.5" />
              COFFEE / TEA COUNTER
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

        {/* Cup Counter Display */}
        <div className="bg-nirmaan-cream p-5 rounded-2xl border border-nirmaan-black/10 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="nirmaan-pill bg-nirmaan-blue text-white text-[10px] font-black">
              EVENT TOTAL ALLOCATION: 900 CUPS
            </span>
          </div>
          <p className="text-xs font-bold uppercase text-nirmaan-black/60 tracking-wider">
            CUPS CONSUMED BY TEAM
          </p>
          <div className="my-2 font-display text-4xl font-black text-nirmaan-black flex items-center justify-center gap-3">
            <span>{team.coffee_count}</span>
            <span className="text-nirmaan-blue text-2xl">➔</span>
            <span className="text-nirmaan-blue font-black">{team.coffee_count + 1}</span>
          </div>
          <p className="text-xs font-medium text-nirmaan-black/60">
            Click serve to record 1 cup for this team
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="nirmaan-btn nirmaan-btn-outline w-1/3 text-xs py-3.5"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirmServe}
            disabled={loading}
            className="nirmaan-btn bg-nirmaan-blue text-white hover:bg-blue-700 w-2/3 text-xs py-3.5 font-black shadow-lg"
          >
            {loading ? (
              'RECORDING...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                SERVE CUP (+1)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

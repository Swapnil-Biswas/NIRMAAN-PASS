'use client';

import React, { useState } from 'react';
import { Sparkles, Utensils, ShieldCheck, Coffee, Award, Users, Plus, X, Layers, AlertCircle } from 'lucide-react';
import { LimitRule, ScanEvent } from '@/types/database';

interface CustomEventModalProps {
  onClose: () => void;
  onCreated: (event: ScanEvent) => void;
}

const AVAILABLE_COLORS = [
  { label: 'Amber (Orange-Gold)', class: 'bg-nirmaan-amber text-nirmaan-black' },
  { label: 'Red (Crimson)', class: 'bg-nirmaan-red text-white' },
  { label: 'Blue (Cobalt)', class: 'bg-nirmaan-blue text-white' },
  { label: 'Purple (Violet)', class: 'bg-nirmaan-purple text-white' },
  { label: 'Green (Forest)', class: 'bg-nirmaan-green-dark text-white' },
  { label: 'Bright Green (Lime)', class: 'bg-nirmaan-green-bright text-nirmaan-black' },
  { label: 'Orange (Warm)', class: 'bg-nirmaan-orange text-white' },
];

const AVAILABLE_ICONS = [
  { key: 'Sparkles', icon: Sparkles, label: 'Sparkles / Special' },
  { key: 'Utensils', icon: Utensils, label: 'Meal / Snack' },
  { key: 'ShieldCheck', icon: ShieldCheck, label: 'Check-In / Security' },
  { key: 'Coffee', icon: Coffee, label: 'Beverage / Drink' },
  { key: 'Award', icon: Award, label: 'Judging / Review' },
  { key: 'Users', icon: Users, label: 'Mentorship / Team' },
];

export default function CustomEventModal({ onClose, onCreated }: CustomEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [limitRule, setLimitRule] = useState<LimitRule>('per_present_member');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0].class);
  const [selectedIcon, setSelectedIcon] = useState('Sparkles');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an event title.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          limit_rule: limitRule,
          color: selectedColor.split(' ')[0],
          text_color: selectedColor.split(' ')[1] || 'text-white',
          icon: selectedIcon,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create scan event');
      }

      onCreated(data.event);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-nirmaan-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border-2 border-nirmaan-black rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nirmaan-black/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-nirmaan-black text-white flex items-center justify-center">
              <Layers className="w-4 h-4 text-nirmaan-amber" />
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-black uppercase text-nirmaan-black">
                CREATE NEW SCAN EVENT
              </h3>
              <p className="text-[11px] font-semibold text-nirmaan-black/60">
                Add an attendance, meal, or activity check-in type to the live scanner
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-nirmaan-black/50 hover:text-nirmaan-black hover:bg-nirmaan-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-nirmaan-red/10 border border-nirmaan-red/30 rounded-xl text-xs font-bold text-nirmaan-red flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
              EVENT TITLE *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Midnight Snack, Mentorship Round 1, Swag Kit..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-nirmaan-cream/40 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-bold text-xs text-nirmaan-black uppercase tracking-wide"
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
              DESCRIPTION / INSTRUCTIONS (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="e.g. 1 pizza box per present member or round 1 mentor feedback"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-nirmaan-cream/40 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-medium text-xs text-nirmaan-black"
            />
          </div>

          {/* Limit Rule Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
              ENTITLEMENT & CHECK-IN RULE *
            </label>
            <div className="grid grid-cols-1 gap-2">
              <label
                onClick={() => setLimitRule('per_present_member')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                  limitRule === 'per_present_member'
                    ? 'border-nirmaan-black bg-nirmaan-cream/60 shadow-xs'
                    : 'border-nirmaan-black/15 bg-white hover:bg-nirmaan-cream/30'
                }`}
              >
                <input
                  type="radio"
                  name="limitRule"
                  checked={limitRule === 'per_present_member'}
                  onChange={() => setLimitRule('per_present_member')}
                  className="mt-0.5 text-nirmaan-black"
                />
                <div>
                  <p className="font-bold text-xs text-nirmaan-black uppercase">
                    🍽️ Up to Verified Present Members
                  </p>
                  <p className="text-[11px] font-medium text-nirmaan-black/60">
                    Maximum count equals team&apos;s verified present headcount from On-Desk Registration (like breakfast/lunch).
                  </p>
                </div>
              </label>

              <label
                onClick={() => setLimitRule('once_per_team')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                  limitRule === 'once_per_team'
                    ? 'border-nirmaan-black bg-nirmaan-cream/60 shadow-xs'
                    : 'border-nirmaan-black/15 bg-white hover:bg-nirmaan-cream/30'
                }`}
              >
                <input
                  type="radio"
                  name="limitRule"
                  checked={limitRule === 'once_per_team'}
                  onChange={() => setLimitRule('once_per_team')}
                  className="mt-0.5 text-nirmaan-black"
                />
                <div>
                  <p className="font-bold text-xs text-nirmaan-black uppercase">
                    🛡️ 1 Single Check-In per Team
                  </p>
                  <p className="text-[11px] font-medium text-nirmaan-black/60">
                    Team can only scan once. Subsequent scans are rejected as already completed (e.g. Mentorship session, Stage pitch).
                  </p>
                </div>
              </label>

              <label
                onClick={() => setLimitRule('unlimited')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                  limitRule === 'unlimited'
                    ? 'border-nirmaan-black bg-nirmaan-cream/60 shadow-xs'
                    : 'border-nirmaan-black/15 bg-white hover:bg-nirmaan-cream/30'
                }`}
              >
                <input
                  type="radio"
                  name="limitRule"
                  checked={limitRule === 'unlimited'}
                  onChange={() => setLimitRule('unlimited')}
                  className="mt-0.5 text-nirmaan-black"
                />
                <div>
                  <p className="font-bold text-xs text-nirmaan-black uppercase">
                    ⚡ Unlimited Increment Counter
                  </p>
                  <p className="text-[11px] font-medium text-nirmaan-black/60">
                    No upper limit. Every scan increments total servings/units (like coffee/tea or energy drinks).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Color Palette Choice */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
              BADGE COLOR THEME
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map((c) => (
                <button
                  key={c.class}
                  type="button"
                  onClick={() => setSelectedColor(c.class)}
                  className={`nirmaan-pill text-[10px] font-black py-1 px-3 border transition-all cursor-pointer ${c.class} ${
                    selectedColor === c.class
                      ? 'border-2 border-nirmaan-black scale-105 shadow-xs'
                      : 'border-nirmaan-black/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  {c.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Choice */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
              SCANNER ICON
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AVAILABLE_ICONS.map((i) => {
                const IconComponent = i.icon;
                const isSelected = selectedIcon === i.key;
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => setSelectedIcon(i.key)}
                    className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-nirmaan-black bg-nirmaan-black text-white shadow-xs'
                        : 'border-nirmaan-black/15 bg-white text-nirmaan-black hover:bg-nirmaan-cream/40'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{i.key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-nirmaan-black/10">
            <button
              type="button"
              onClick={onClose}
              className="nirmaan-pill bg-nirmaan-cream hover:bg-nirmaan-black hover:text-white text-nirmaan-black text-xs font-bold py-2.5 px-4 border border-nirmaan-black/15 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="nirmaan-btn nirmaan-btn-primary text-xs font-black py-2.5 px-5 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'CREATING...' : 'ADD SCAN EVENT'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

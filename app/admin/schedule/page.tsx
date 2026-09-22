'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { ScheduleItem } from '@/types/database';

const COLOR_PRESETS = [
  { label: 'Amber', color: 'bg-nirmaan-amber', textColor: 'text-nirmaan-black' },
  { label: 'Blue', color: 'bg-nirmaan-blue', textColor: 'text-white' },
  { label: 'Green', color: 'bg-nirmaan-green-bright', textColor: 'text-nirmaan-black' },
  { label: 'Dark Green', color: 'bg-nirmaan-green-dark', textColor: 'text-white' },
  { label: 'Orange', color: 'bg-nirmaan-orange', textColor: 'text-white' },
  { label: 'Purple', color: 'bg-nirmaan-purple', textColor: 'text-white' },
  { label: 'Red', color: 'bg-nirmaan-red', textColor: 'text-white' },
];

const TAG_PRESETS = [
  'REGISTRATION',
  'KEYNOTE',
  'BUILD',
  'MEALS',
  'MENTORING',
  'SOCIAL',
  'FINALE',
  'AWARDS',
];

export default function AdminSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form / Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [formTime, setFormTime] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formTag, setFormTag] = useState('BUILD');
  const [formColor, setFormColor] = useState('bg-nirmaan-blue');
  const [formTextColor, setFormTextColor] = useState('text-white');

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schedule');
      const data = await res.json();
      if (data.success && Array.isArray(data.schedule)) {
        setSchedule(data.schedule);
      }
    } catch {
      showFeedback('error', 'Failed to load timeline schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormTime('');
    setFormTitle('');
    setFormTag('BUILD');
    setFormColor('bg-nirmaan-blue');
    setFormTextColor('text-white');
    setIsModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormTime(item.time);
    setFormTitle(item.title);
    setFormTag(item.tag);
    setFormColor(item.color);
    setFormTextColor(item.text_color || (item.color.includes('amber') || item.color.includes('green-bright') ? 'text-nirmaan-black' : 'text-white'));
    setIsModalOpen(true);
  };

  const handleSelectColor = (preset: typeof COLOR_PRESETS[0]) => {
    setFormColor(preset.color);
    setFormTextColor(preset.textColor);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTime.trim() || !formTitle.trim()) {
      showFeedback('error', 'Time and Title are required.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingItem) {
        // Update
        const res = await fetch('/api/admin/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            time: formTime.trim(),
            title: formTitle.trim(),
            tag: formTag.trim().toUpperCase(),
            color: formColor,
            text_color: formTextColor,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showFeedback('success', `Updated "${formTitle.trim()}" successfully.`);
          setIsModalOpen(false);
          fetchSchedule();
        } else {
          showFeedback('error', data.message || 'Failed to update item.');
        }
      } else {
        // Create
        const res = await fetch('/api/admin/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: formTime.trim(),
            title: formTitle.trim(),
            tag: formTag.trim().toUpperCase(),
            color: formColor,
            text_color: formTextColor,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showFeedback('success', `Created "${formTitle.trim()}" successfully.`);
          setIsModalOpen(false);
          fetchSchedule();
        } else {
          showFeedback('error', data.message || 'Failed to create item.');
        }
      }
    } catch {
      showFeedback('error', 'Network error while saving timeline event.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove "${title}" from the schedule?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/schedule?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('success', `Removed "${title}".`);
        fetchSchedule();
      } else {
        showFeedback('error', data.message || 'Failed to delete item.');
      }
    } catch {
      showFeedback('error', 'Network error while deleting item.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schedule.length) return;

    const newSchedule = [...schedule];
    const temp = newSchedule[index];
    newSchedule[index] = newSchedule[targetIndex];
    newSchedule[targetIndex] = temp;

    // Recalculate order indices
    const reorderedPayload = newSchedule.map((item, idx) => ({
      id: item.id,
      order_index: idx + 1,
    }));

    // Optimistic UI update
    setSchedule(newSchedule);

    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: reorderedPayload }),
      });
      const data = await res.json();
      if (!data.success) {
        fetchSchedule();
        showFeedback('error', 'Failed to save new order.');
      }
    } catch {
      fetchSchedule();
      showFeedback('error', 'Network error while reordering.');
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all schedule events? This will remove all timeline items from /event-info.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/schedule/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback('success', 'Schedule cleared successfully.');
        fetchSchedule();
      } else {
        showFeedback('error', data.message || 'Failed to clear schedule.');
      }
    } catch {
      showFeedback('error', 'Network error while clearing schedule.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-black/70 hover:text-nirmaan-black mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO ADMIN DASHBOARD
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-nirmaan-black">
              SCHEDULE &amp; TIMELINE
            </h1>
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-xs font-black">
              DYNAMIC
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70 mt-1">
            Manage the official 25-hour timeline live for participants on /event-info
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={openAddModal}
            className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-4 font-black shadow-sm flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            ADD EVENT
          </button>
          <button
            onClick={handleClear}
            disabled={actionLoading || schedule.length === 0}
            className="nirmaan-btn bg-white hover:bg-nirmaan-cream text-nirmaan-black text-xs py-2.5 px-3.5 font-black border border-nirmaan-black/20 shadow-sm disabled:opacity-40"
            title="Clear all events from schedule"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden md:inline">CLEAR ALL</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl font-bold text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-nirmaan-green-bright text-nirmaan-black'
              : 'bg-nirmaan-red text-white'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Content Card */}
      <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-nirmaan-black/10">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-nirmaan-orange" />
            <h2 className="font-display text-lg font-black uppercase text-nirmaan-black">
              TIMELINE SEQUENCE ({schedule.length} EVENTS)
            </h2>
          </div>
          <span className="text-xs font-bold text-nirmaan-black/50 uppercase tracking-wider">
            25-HOUR RUNTIME
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-nirmaan-black/60 uppercase">
            Loading timeline events...
          </div>
        ) : schedule.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm font-bold text-nirmaan-black/60 uppercase">
              Schedule is currently empty.
            </p>
            <p className="text-xs font-medium text-nirmaan-black/50 max-w-sm mx-auto">
              Add your official event timeline milestones using the button below.
            </p>
            <button
              onClick={openAddModal}
              className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-5 font-black inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              ADD FIRST EVENT
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 sm:p-3.5 rounded-2xl bg-nirmaan-cream/40 border border-nirmaan-black/10 flex items-center justify-between gap-2 group transition-all hover:bg-nirmaan-cream/70 hover:border-nirmaan-black/25"
              >
                {/* Left info */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0 || actionLoading}
                      className="p-1 text-nirmaan-black/40 hover:text-nirmaan-black disabled:opacity-20 disabled:hover:text-nirmaan-black/40 transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === schedule.length - 1 || actionLoading}
                      className="p-1 text-nirmaan-black/40 hover:text-nirmaan-black disabled:opacity-20 disabled:hover:text-nirmaan-black/40 transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-mono text-[11px] sm:text-xs font-black text-nirmaan-black bg-white px-2 py-1 rounded-lg border border-nirmaan-black/10 shadow-xs flex-shrink-0 whitespace-nowrap">
                    {item.time}
                  </span>

                  <div className="min-w-0">
                    <p className="font-bold text-xs text-nirmaan-black line-clamp-2 sm:truncate">
                      {item.title}
                    </p>
                  </div>
                </div>

                {/* Right badge &amp; actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className={`nirmaan-pill ${item.color} ${
                      item.text_color ||
                      (item.color.includes('amber') || item.color.includes('green-bright')
                        ? 'text-nirmaan-black'
                        : 'text-white')
                    } text-[9px] sm:text-[10px] font-black shadow-2xs hidden xs:inline-flex`}
                  >
                    {item.tag}
                  </span>

                  <div className="flex items-center gap-1 border-l border-nirmaan-black/10 pl-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-nirmaan-black/70 hover:text-nirmaan-blue hover:bg-white transition-all"
                      title="Edit item"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-nirmaan-black/70 hover:text-nirmaan-red hover:bg-white transition-all"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nirmaan-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black shadow-2xl max-w-lg w-full space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-nirmaan-black/10">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-nirmaan-orange" />
                <h3 className="font-display text-lg font-black uppercase text-nirmaan-black">
                  {editingItem ? 'EDIT TIMELINE EVENT' : 'ADD TIMELINE EVENT'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-nirmaan-black/60 hover:text-nirmaan-black rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Time */}
              <div>
                <label className="block text-xs font-bold uppercase text-nirmaan-black/80 mb-1">
                  Time Label
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="e.g. 09:00 AM or 11:30 PM"
                    required
                    className="w-full bg-nirmaan-cream/40 border-2 border-nirmaan-black/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-nirmaan-black focus:outline-hidden focus:border-nirmaan-black"
                  />
                  <Clock className="w-4 h-4 text-nirmaan-black/40 absolute right-3 top-2.5" />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase text-nirmaan-black/80 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. MENTORSHIP ROUND 1 (BAY INSPECTION)"
                  required
                  className="w-full bg-nirmaan-cream/40 border-2 border-nirmaan-black/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-nirmaan-black focus:outline-hidden focus:border-nirmaan-black"
                />
              </div>

              {/* Category Tag */}
              <div>
                <label className="block text-xs font-bold uppercase text-nirmaan-black/80 mb-1.5">
                  Category Tag
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TAG_PRESETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormTag(t)}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                        formTag === t
                          ? 'bg-nirmaan-black text-white border-nirmaan-black'
                          : 'bg-white text-nirmaan-black/80 border-nirmaan-black/15 hover:border-nirmaan-black/40'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value.toUpperCase())}
                  placeholder="Or enter custom tag"
                  className="w-full bg-nirmaan-cream/40 border-2 border-nirmaan-black/20 rounded-xl px-3 py-1.5 text-xs font-bold text-nirmaan-black focus:outline-hidden focus:border-nirmaan-black"
                />
              </div>

              {/* Badge Color Preset */}
              <div>
                <label className="block text-xs font-bold uppercase text-nirmaan-black/80 mb-1.5">
                  Badge Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectColor(preset)}
                      className={`h-8 rounded-xl flex items-center justify-center font-bold text-[10px] border-2 transition-all ${
                        preset.color
                      } ${preset.textColor} ${
                        formColor === preset.color
                          ? 'border-nirmaan-black shadow-sm scale-105 ring-2 ring-nirmaan-black'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      {preset.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-nirmaan-cream rounded-xl border border-nirmaan-black/10">
                <span className="text-[10px] font-black uppercase text-nirmaan-black/50 block mb-1.5">
                  Live Preview:
                </span>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-nirmaan-black/10">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-black text-nirmaan-black bg-white px-2 py-0.5 rounded-md border border-nirmaan-black/10">
                      {formTime || '11:00 AM'}
                    </span>
                    <span className="font-bold text-xs text-nirmaan-black">
                      {formTitle || 'EVENT TITLE PREVIEW'}
                    </span>
                  </div>
                  <span
                    className={`nirmaan-pill ${formColor} ${formTextColor} text-[9px] font-black`}
                  >
                    {formTag || 'BUILD'}
                  </span>
                </div>
              </div>

              {/* Submit / Cancel buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-nirmaan-black/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="nirmaan-btn bg-white hover:bg-nirmaan-cream text-nirmaan-black text-xs py-2 px-4 font-bold border border-nirmaan-black/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="nirmaan-btn nirmaan-btn-primary text-xs py-2 px-5 font-black shadow-sm"
                >
                  {actionLoading ? 'Saving...' : editingItem ? 'Update Event' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

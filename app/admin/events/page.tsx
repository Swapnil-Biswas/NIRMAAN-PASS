'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Utensils,
  ShieldCheck,
  Coffee,
  Award,
  Users,
  QrCode,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { ScanEvent } from '@/types/database';
import CustomEventModal from '@/components/Admin/CustomEventModal';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Utensils,
  ShieldCheck,
  Coffee,
  Award,
  Users,
  Sun,
  Moon,
};

const BASELINE_EVENTS = [
  {
    id: 'registration',
    title: 'ON-DESK REGISTRATION',
    description: 'Verifies physical member attendance at BMSIT reception on event day. Capped at registered members.',
    limit_rule: 'Sets present headcount',
    color: 'bg-nirmaan-green-bright',
    text_color: 'text-nirmaan-black',
    icon: ShieldCheck,
    isCore: true,
  },
  {
    id: 'breakfast',
    title: 'BREAKFAST',
    description: 'Morning meal entitlement. Limit capped at verified present headcount.',
    limit_rule: 'Up to present headcount',
    color: 'bg-nirmaan-amber',
    text_color: 'text-nirmaan-black',
    icon: Sun,
    isCore: true,
  },
  {
    id: 'lunch',
    title: 'LUNCH',
    description: 'Afternoon meal entitlement. Limit capped at verified present headcount.',
    limit_rule: 'Up to present headcount',
    color: 'bg-nirmaan-orange',
    text_color: 'text-white',
    icon: Utensils,
    isCore: true,
  },
  {
    id: 'dinner',
    title: 'DINNER',
    description: 'Night meal entitlement. Limit capped at verified present headcount.',
    limit_rule: 'Up to present headcount',
    color: 'bg-nirmaan-purple',
    text_color: 'text-white',
    icon: Moon,
    isCore: true,
  },
  {
    id: 'coffee',
    title: 'COFFEE / TEA',
    description: 'Unlimited refreshment counter throughout the 25-hour hackathon.',
    limit_rule: 'Unlimited',
    color: 'bg-nirmaan-blue',
    text_color: 'text-white',
    icon: Coffee,
    isCore: true,
  },
];

export default function AdminEventsPage() {
  const [customEvents, setCustomEvents] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomEvents(data.events || []);
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load custom scan events' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete scan event "${title}"? All scan logs for this event will also be removed.`)) {
      return;
    }

    setDeleteLoading(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete event');
      }

      setCustomEvents((prev) => prev.filter((e) => e.id !== id));
      setFeedback({ type: 'success', message: `Scan event "${title}" deleted successfully.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error deleting event' });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleEventCreated = (newEvent: ScanEvent) => {
    setCustomEvents((prev) => [...prev, newEvent]);
    setFeedback({ type: 'success', message: `Scan event "${newEvent.title}" created and added to scanner!` });
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-nirmaan-black/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1 text-xs font-bold text-nirmaan-black/60 hover:text-nirmaan-black"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-black uppercase text-nirmaan-black">
            SCAN EVENTS &amp; CHECK-IN TYPES
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/60 mt-1">
            Manage live QR scanner modes, meal entitlements, mentorship check-ins, and custom event activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/scanner"
            className="nirmaan-btn nirmaan-btn-dark text-xs py-2.5 px-4 font-black shadow-sm flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4 text-nirmaan-amber" />
            <span>OPEN SCANNER</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-4 font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ ADD SCAN EVENT</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-nirmaan-green-bright/20 border-nirmaan-green-dark text-nirmaan-black'
              : 'bg-nirmaan-red/10 border-nirmaan-red text-nirmaan-red'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-nirmaan-green-dark flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-nirmaan-red flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Custom Scan Events Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-xs font-black">
              CUSTOM SCAN MODES
            </span>
            <span className="text-xs font-bold text-nirmaan-black/60">
              ({customEvents.length} Active in Scanner)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold text-nirmaan-blue hover:underline cursor-pointer"
          >
            + Create New Event
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-nirmaan-black/10 font-bold text-xs text-nirmaan-black/50">
            Loading scan events...
          </div>
        ) : customEvents.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-nirmaan-black/20 space-y-3">
            <Sparkles className="w-8 h-8 mx-auto text-nirmaan-amber" />
            <h3 className="font-display font-black text-sm uppercase text-nirmaan-black">
              NO CUSTOM SCAN EVENTS YET
            </h3>
            <p className="text-xs font-semibold text-nirmaan-black/60 max-w-md mx-auto">
              Add extra attendance or distribution sessions like Midnight Pizza, Mentorship Feedback, Judging Check-In, or Swag Kits.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="nirmaan-btn nirmaan-btn-primary text-xs py-2 px-4 font-black shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>CREATE FIRST EVENT</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customEvents.map((evt) => {
              const IconComp = (evt.icon && ICON_MAP[evt.icon]) || Sparkles;
              return (
                <div
                  key={evt.id}
                  className="nirmaan-card p-5 bg-white border-2 border-nirmaan-black shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`nirmaan-pill ${evt.color} ${evt.text_color || 'text-white'} text-[10px] font-black uppercase inline-flex items-center gap-1`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>LIVE IN SCANNER</span>
                      </span>
                      <button
                        type="button"
                        disabled={deleteLoading === evt.id}
                        onClick={() => handleDelete(evt.id, evt.title)}
                        className="p-1.5 rounded-lg text-nirmaan-red hover:bg-nirmaan-red/10 transition-colors disabled:opacity-50"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="font-display font-black text-base uppercase text-nirmaan-black tracking-tight">
                      {evt.title}
                    </h3>
                    {evt.description && (
                      <p className="text-xs font-medium text-nirmaan-black/70">
                        {evt.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-nirmaan-black/10 flex items-center justify-between text-xs">
                    <span className="font-bold text-nirmaan-black/60">Rule:</span>
                    <span className="font-extrabold text-nirmaan-black bg-nirmaan-cream px-2 py-0.5 rounded-md border border-nirmaan-black/10">
                      {evt.limit_rule === 'once_per_team'
                        ? '1 Per Team'
                        : evt.limit_rule === 'per_present_member'
                        ? 'Present Headcount'
                        : 'Unlimited Counter'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Baseline Core Events Section */}
      <section className="space-y-4 pt-4 border-t border-nirmaan-black/10">
        <div className="flex items-center gap-2">
          <span className="nirmaan-pill bg-nirmaan-black text-white text-xs font-black">
            STANDARD HACKATHON MODES
          </span>
          <span className="text-xs font-bold text-nirmaan-black/60">
            (Built-In Event Operations)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BASELINE_EVENTS.map((evt) => {
            const IconComp = evt.icon;
            return (
              <div
                key={evt.id}
                className="nirmaan-card p-5 bg-white border border-nirmaan-black/15 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <span
                    className={`nirmaan-pill ${evt.color} ${evt.text_color} text-[10px] font-black uppercase inline-flex items-center gap-1`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>CORE MODE</span>
                  </span>
                  <h3 className="font-display font-black text-base uppercase text-nirmaan-black tracking-tight">
                    {evt.title}
                  </h3>
                  <p className="text-xs font-medium text-nirmaan-black/70">
                    {evt.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-nirmaan-black/10 flex items-center justify-between text-xs">
                  <span className="font-bold text-nirmaan-black/60">Entitlement:</span>
                  <span className="font-extrabold text-nirmaan-black bg-nirmaan-cream px-2 py-0.5 rounded-md border border-nirmaan-black/10">
                    {evt.limit_rule}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Creation Modal */}
      {isModalOpen && (
        <CustomEventModal
          onClose={() => setIsModalOpen(false)}
          onCreated={handleEventCreated}
        />
      )}
    </main>
  );
}

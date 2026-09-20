'use client';

import React, { useState, useEffect } from 'react';
import { Megaphone, Send, CheckCircle2, AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import { Announcement, PriorityLevel } from '@/types/database';
import Link from 'next/link';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements?all=true', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.announcements);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Remove announcement "${title}"?`)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        fetchAnnouncements();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.message || 'Failed to delete announcement.');
      }
    } catch {
      setError('Network error while deleting announcement.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          published: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTitle('');
        setMessage('');
        fetchAnnouncements();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.message || 'Failed to publish announcement.');
      }
    } catch {
      setError('Network error while broadcasting announcement.');
    } finally {
      setLoading(false);
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
            <h1 className="font-display text-3xl font-black uppercase text-nirmaan-black">
              BROADCAST ANNOUNCEMENTS
            </h1>
          </div>
        </div>

        {/* 2-Column: Form & Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-6">
            <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Megaphone className="w-5 h-5 text-nirmaan-red" />
                <h2 className="font-display text-lg font-black uppercase text-nirmaan-black">
                  NEW BROADCAST MESSAGE
                </h2>
              </div>

              {success && (
                <div className="bg-nirmaan-green-bright text-nirmaan-black p-3.5 rounded-xl font-bold text-xs mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Announcement published live to all participant dashboards!
                </div>
              )}

              {error && (
                <div className="bg-nirmaan-red text-white p-3.5 rounded-xl font-bold text-xs mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1">
                    ANNOUNCEMENT TITLE
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LUNCH COUNTER CLOSING IN 15 MINS"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-bold text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1">
                    PRIORITY LEVEL
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'normal', label: 'NORMAL', color: 'bg-nirmaan-blue text-white' },
                        { id: 'important', label: 'IMPORTANT', color: 'bg-nirmaan-amber text-nirmaan-black' },
                        { id: 'urgent', label: 'URGENT', color: 'bg-nirmaan-red text-white' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={`nirmaan-pill py-2.5 justify-center text-[10px] font-black transition-all ${
                          priority === p.id
                            ? `${p.color} ring-2 ring-nirmaan-black scale-102`
                            : 'bg-nirmaan-cream text-nirmaan-black opacity-70 border border-nirmaan-black/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1">
                    MESSAGE CONTENT
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter message details for participants..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-medium text-xs leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="nirmaan-btn nirmaan-btn-primary w-full text-xs py-3.5 font-black shadow-md"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'PUBLISHING...' : 'PUBLISH LIVE TO PASS PORTAL'}
                </button>
              </form>
            </div>
          </div>

          {/* Published Feed */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="font-display text-sm font-black uppercase text-nirmaan-black">
              CURRENTLY BROADCASTING ({announcements.length})
            </h3>
            {announcements.length === 0 ? (
              <div className="nirmaan-card p-6 text-center text-nirmaan-black/60 border border-nirmaan-black/10">
                <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-bold text-sm">No announcements yet</p>
                <p className="text-xs">Create your first broadcast using the form.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => {
                  const priorityStyles = ann.priority === 'urgent'
                    ? { label: 'URGENT', bg: 'bg-nirmaan-red', text: 'text-white', border: 'border-nirmaan-red' }
                    : ann.priority === 'important'
                    ? { label: 'IMPORTANT', bg: 'bg-nirmaan-amber', text: 'text-nirmaan-black', border: 'border-nirmaan-amber' }
                    : { label: 'ANNOUNCEMENT', bg: 'bg-nirmaan-blue', text: 'text-white', border: 'border-nirmaan-blue' };

                  return (
                    <div
                      key={ann.id}
                      className={`nirmaan-card p-5 bg-white border-l-4 ${priorityStyles.border} shadow-sm`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`nirmaan-pill ${priorityStyles.bg} ${priorityStyles.text} text-[10px] font-black`}>
                          {priorityStyles.label}
                        </span>
                        <button
                          onClick={() => handleDelete(ann.id, ann.title)}
                          disabled={loading}
                          className="p-1.5 rounded-lg text-nirmaan-red/60 hover:text-nirmaan-red hover:bg-nirmaan-red/10 transition-colors disabled:opacity-50"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h4 className="font-display text-base font-black uppercase text-nirmaan-black mb-1">
                        {ann.title}
                      </h4>
                      <p className="text-sm font-medium text-nirmaan-black/80 leading-relaxed">
                        {ann.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

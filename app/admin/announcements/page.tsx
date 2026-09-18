'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Megaphone, Send, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Announcement, PriorityLevel } from '@/types/database';
import AnnouncementList from '@/components/AnnouncementCard/AnnouncementList';
import Link from 'next/link';

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements?all=true');
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.announcements);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setLoading(true);
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
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col">
      <Navbar />

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
            <AnnouncementList announcements={announcements} />
          </div>
        </div>
      </main>
    </div>
  );
}

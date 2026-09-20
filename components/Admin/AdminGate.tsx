'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, KeyRound, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AdminGate() {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/admin/scanner');
        router.refresh();
      } else {
        setError(data.message || 'Invalid Organizer Access Code.');
      }
    } catch {
      setError('Network error verifying access code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="nirmaan-card p-8 bg-white border-2 border-nirmaan-black shadow-lg space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-nirmaan-black text-white flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Lock className="w-6 h-6 text-nirmaan-amber" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nirmaan-red/10 text-nirmaan-red text-[11px] font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              RESTRICTED ACCESS
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-nirmaan-black tracking-tight">
              ORGANIZER CONSOLE
            </h1>

            <p className="text-xs font-semibold text-nirmaan-black/60 max-w-xs mx-auto">
              Enter authorized event access code to unlock queue scanner and operational controls.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-nirmaan-red/10 border border-nirmaan-red/30 text-nirmaan-red text-xs font-bold text-center">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 tracking-wider">
                ORGANIZER ACCESS CODE
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter access code..."
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-nirmaan-cream/40 rounded-xl border-2 border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-mono text-xs text-nirmaan-black pr-10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nirmaan-black/40 hover:text-nirmaan-black"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full nirmaan-btn nirmaan-btn-dark py-3 text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <span>{loading ? 'VERIFYING...' : 'UNLOCK CONSOLE'}</span>
              <ArrowRight className="w-4 h-4 text-nirmaan-amber" />
            </button>
          </form>

          {/* Security Notice & Exit */}
          <div className="pt-4 border-t border-nirmaan-black/10 text-center space-y-3">
            <p className="text-[10px] font-medium text-nirmaan-black/40">
              Authorized NIRMAAN 2026 event desk personnel only.
            </p>
            <Link
              href="/"
              className="text-xs font-bold text-nirmaan-black/60 hover:text-nirmaan-black inline-block"
            >
              ← Return to Participant Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

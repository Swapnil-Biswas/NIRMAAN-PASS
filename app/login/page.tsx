'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, LogIn, ArrowRight, Zap, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid email or credentials. Please try again.');
        return;
      }

      // Successful login — redirect to dashboard
      router.push(searchParams.get('redirect') || '/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col items-center justify-center px-4">
      {/* Background Accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-nirmaan-amber/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-nirmaan-blue/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
                <Zap className="w-3 h-3 text-nirmaan-amber" />
                NIRMAAN 2026
              </span>
            </div>
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-nirmaan-black">
            ACCESS TEAM PASS
          </h1>
          <p className="text-sm text-nirmaan-black/60 font-medium">
            Enter the team leader email used during registration
          </p>
        </div>

        {/* Login Form */}
        <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black/10">
          {error && (
            <div className="bg-nirmaan-red/10 border border-nirmaan-red/30 text-nirmaan-red p-3.5 rounded-xl font-bold text-xs mb-6 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1.5"
              >
                TEAM EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nirmaan-black/40" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="team-leader@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black focus:ring-2 focus:ring-nirmaan-amber/30 outline-none font-medium text-sm transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 text-sm font-black shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  SIGNING IN...
                </span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  SIGN IN
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3">
          <p className="text-xs text-nirmaan-black/50 font-medium">
            Haven&apos;t registered your team yet?
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-blue hover:text-nirmaan-blue/80 transition-colors"
          >
            REGISTER YOUR TEAM
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nirmaan-cream flex items-center justify-center font-bold text-nirmaan-black">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

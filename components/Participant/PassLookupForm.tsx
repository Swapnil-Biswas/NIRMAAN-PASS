'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface PassLookupFormProps {
  redirectTo?: string;
  placeholder?: string;
  buttonText?: string;
}

export default function PassLookupForm({
  redirectTo = '/pass',
  placeholder = 'Team leader email...',
  buttonText = 'OPEN PASS',
}: PassLookupFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'No registered team found matching this email.');
        setLoading(false);
        return;
      }

      // Successful login - directly go to pass/redirect target
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-2">
      <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2 w-full">
        <div className="relative flex-1">
          <Mail className="w-4 h-4 text-nirmaan-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-full border-2 border-nirmaan-black/20 focus:border-nirmaan-black outline-none text-sm text-nirmaan-black transition-colors"
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="nirmaan-btn nirmaan-btn-primary text-xs px-6 py-3 font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>OPENING...</span>
            </span>
          ) : (
            <>
              <span>{buttonText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
      {error && (
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-nirmaan-red bg-nirmaan-red/10 border border-nirmaan-red/20 py-2 px-3 rounded-lg text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

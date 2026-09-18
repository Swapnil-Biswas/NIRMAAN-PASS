'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, ArrowRight } from 'lucide-react';

export default function PassLookupForm() {
  const [token, setToken] = useState('');
  const router = useRouter();

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = token.trim();
    if (!clean) return;
    router.push(`/pass?token=${encodeURIComponent(clean)}`);
  };

  return (
    <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2 w-full max-w-lg mx-auto">
      <div className="relative flex-1">
        <QrCode className="w-4 h-4 text-nirmaan-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter Team QR Token..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-full border-2 border-nirmaan-black/20 focus:border-nirmaan-black outline-none font-mono text-xs text-nirmaan-black transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={!token.trim()}
        className="nirmaan-btn nirmaan-btn-primary text-xs px-6 py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <span>OPEN PASS</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

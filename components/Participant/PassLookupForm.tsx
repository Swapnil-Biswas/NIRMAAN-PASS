'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight } from 'lucide-react';

export default function PassLookupForm() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleLookup = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.trim()) router.push(`/login?email=${encodeURIComponent(email.trim())}&redirect=/pass`);
  };

  return (
    <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2 w-full max-w-lg mx-auto">
      <div className="relative flex-1">
        <Mail className="w-4 h-4 text-nirmaan-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Team leader email..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-full border-2 border-nirmaan-black/20 focus:border-nirmaan-black outline-none text-sm text-nirmaan-black transition-colors"
          required
        />
      </div>
      <button type="submit" className="nirmaan-btn nirmaan-btn-primary text-xs px-6 py-3 font-bold flex items-center justify-center gap-1.5">
        <span>OPEN PASS</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

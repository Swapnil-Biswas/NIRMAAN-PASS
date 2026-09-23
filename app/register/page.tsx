'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login where leaders enter their email to access their QR pass
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md text-center space-y-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
            <Zap className="w-3 h-3 text-nirmaan-amber" />
            NIRMAAN 2026
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-nirmaan-black">
          REGISTRATIONS LOADED
        </h1>

        <div className="nirmaan-card p-6 bg-white border-2 border-nirmaan-black/10 space-y-4">
          <div className="w-12 h-12 rounded-full bg-nirmaan-green-bright/20 flex items-center justify-center mx-auto text-nirmaan-green-dark">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <p className="text-xs sm:text-sm text-nirmaan-black/80 font-medium leading-relaxed">
            All participating teams have been loaded. Team leaders can immediately sign in with their registered email to view and download their digital QR pass.
          </p>

          <Link
            href="/login"
            className="nirmaan-btn nirmaan-btn-primary w-full py-3 text-xs font-black shadow-md inline-flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>ACCESS TEAM PASS VIA LEADER EMAIL</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

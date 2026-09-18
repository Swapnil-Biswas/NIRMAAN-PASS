'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Zap, ArrowRight, Mail, Lock, Eye, EyeOff,
  CheckCircle2, AlertCircle, Users, Shield, KeyRound,
} from 'lucide-react';
import Link from 'next/link';

type ActivationStep = 'verify' | 'credentials' | 'success';

export default function ActivatePage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<ActivationStep>('verify');

  // Step 1: Verify team via leader email
  const [leaderEmail, setLeaderEmail] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [memberCount, setMemberCount] = useState(0);

  // Step 2: Create credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  /**
   * Step 1: Verify the team exists in the database by checking if a member
   * with the provided email is the team leader (first member of a team).
   * The team must not already have an auth_id.
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifyLoading(true);

    try {
      const res = await fetch('/api/activate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: leaderEmail.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setVerifyError(data.message || 'Team not found. Check your email and try again.');
        return;
      }

      setTeamName(data.team_name);
      setCollege(data.college);
      setMemberCount(data.member_count);
      setStep('credentials');
    } catch {
      setVerifyError('Connection error. Please check your internet and try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  /**
   * Step 2: Create Supabase Auth account and link it to the team.
   */
  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError(null);

    if (password.length < 6) {
      setCredError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setCredError('Passwords do not match.');
      return;
    }

    setCredLoading(true);

    try {
      const supabase = createClient();

      // Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: leaderEmail.trim(),
        password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setCredError('This email is already registered. Please log in instead.');
        } else {
          setCredError(signUpError.message);
        }
        return;
      }

      if (!authData.user) {
        setCredError('Account creation failed. Please try again.');
        return;
      }

      // Link auth account to team via API
      const res = await fetch('/api/activate/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: leaderEmail.trim(),
          auth_id: authData.user.id,
        }),
      });

      const linkData = await res.json();

      if (!linkData.success) {
        setCredError(linkData.message || 'Failed to link account to team.');
        return;
      }

      setStep('success');
    } catch {
      setCredError('An unexpected error occurred. Please try again.');
    } finally {
      setCredLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col items-center justify-center px-4">
      {/* Background accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-nirmaan-green-bright/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-nirmaan-purple/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
                <Zap className="w-3 h-3 text-nirmaan-green-bright" />
                NIRMAAN 2026
              </span>
            </div>
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-nirmaan-black">
            ACTIVATE TEAM
          </h1>
          <p className="text-sm text-nirmaan-black/60 font-medium">
            Claim your pre-registered team and create login credentials
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-3">
          {['VERIFY', 'CREDENTIALS', 'DONE'].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 ${
                i === 0 && step === 'verify' ? 'text-nirmaan-blue' :
                i === 1 && step === 'credentials' ? 'text-nirmaan-blue' :
                i === 2 && step === 'success' ? 'text-nirmaan-green-dark' :
                (step === 'credentials' && i === 0) || (step === 'success' && i <= 1) ? 'text-nirmaan-green-dark' :
                'text-nirmaan-black/30'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                  (step === 'credentials' && i === 0) || (step === 'success' && i <= 1) ? 'bg-nirmaan-green-dark text-white' :
                  (i === 0 && step === 'verify') || (i === 1 && step === 'credentials') || (i === 2 && step === 'success')
                    ? 'bg-nirmaan-blue text-white' : 'bg-nirmaan-black/10 text-nirmaan-black/40'
                }`}>
                  {(step === 'credentials' && i === 0) || (step === 'success' && i <= 1) ? '✓' : i + 1}
                </div>
                <span className="text-[10px] font-black uppercase">{label}</span>
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-nirmaan-black/10" />}
            </div>
          ))}
        </div>

        {/* Step 1: Verify Team */}
        {step === 'verify' && (
          <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black/10">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-nirmaan-blue" />
              <h2 className="font-display text-lg font-black uppercase text-nirmaan-black">
                VERIFY YOUR TEAM
              </h2>
            </div>

            <p className="text-xs text-nirmaan-black/60 mb-5 leading-relaxed">
              Enter the email address your team leader used during registration.
              We&apos;ll look up your pre-created team record.
            </p>

            {verifyError && (
              <div className="bg-nirmaan-red/10 border border-nirmaan-red/30 text-nirmaan-red p-3.5 rounded-xl font-bold text-xs mb-5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="activate-email" className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1.5">
                  TEAM LEADER EMAIL
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nirmaan-black/40" />
                  <input
                    id="activate-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="leader@college.edu"
                    value={leaderEmail}
                    onChange={(e) => setLeaderEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black focus:ring-2 focus:ring-nirmaan-blue/30 outline-none font-medium text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="nirmaan-btn nirmaan-btn-dark w-full py-3.5 text-sm font-black shadow-md disabled:opacity-50"
              >
                {verifyLoading ? 'SEARCHING...' : (
                  <>
                    FIND MY TEAM
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Create Credentials */}
        {step === 'credentials' && (
          <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-black/10 space-y-6">
            {/* Team preview */}
            <div className="bg-nirmaan-green-bright/10 border border-nirmaan-green-dark/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-nirmaan-green-dark" />
                <span className="text-[10px] font-black uppercase text-nirmaan-green-dark">TEAM FOUND</span>
              </div>
              <p className="font-display text-lg font-black text-nirmaan-black">{teamName}</p>
              <p className="text-xs text-nirmaan-black/60 font-medium">{college}</p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-nirmaan-black/50">
                <Users className="w-3.5 h-3.5" />
                <span className="font-bold">{memberCount} members registered</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-nirmaan-amber" />
              <h2 className="font-display text-lg font-black uppercase text-nirmaan-black">
                CREATE PASSWORD
              </h2>
            </div>

            <p className="text-xs text-nirmaan-black/60 leading-relaxed">
              Set a password for your team account. You&apos;ll use <strong>{leaderEmail}</strong> and this password to log in.
            </p>

            {credError && (
              <div className="bg-nirmaan-red/10 border border-nirmaan-red/30 text-nirmaan-red p-3.5 rounded-xl font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {credError}
              </div>
            )}

            <form onSubmit={handleCreateCredentials} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1.5">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nirmaan-black/40" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black focus:ring-2 focus:ring-nirmaan-amber/30 outline-none font-medium text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-nirmaan-black/40 hover:text-nirmaan-black transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-bold uppercase text-nirmaan-black/70 mb-1.5">
                  CONFIRM PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nirmaan-black/40" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-nirmaan-black/20 focus:border-nirmaan-black focus:ring-2 focus:ring-nirmaan-amber/30 outline-none font-medium text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={credLoading}
                className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 text-sm font-black shadow-md disabled:opacity-50"
              >
                {credLoading ? 'CREATING ACCOUNT...' : (
                  <>
                    ACTIVATE TEAM ACCOUNT
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="nirmaan-card p-6 sm:p-8 bg-white border-2 border-nirmaan-green-dark/20 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-nirmaan-green-bright/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-nirmaan-green-dark" />
            </div>

            <div>
              <h2 className="font-display text-2xl font-black uppercase text-nirmaan-black mb-2">
                TEAM ACTIVATED!
              </h2>
              <p className="text-sm text-nirmaan-black/60 font-medium">
                <strong>{teamName}</strong> is now live on NIRMAAN-PASS
              </p>
            </div>

            <div className="bg-nirmaan-cream rounded-2xl p-4 text-left space-y-2">
              <p className="text-[10px] font-bold uppercase text-nirmaan-black/50">YOUR LOGIN</p>
              <p className="text-xs font-bold text-nirmaan-black">{leaderEmail}</p>
              <p className="text-[10px] text-nirmaan-black/40">+ the password you just created</p>
            </div>

            <button
              onClick={() => {
                router.push('/dashboard');
                router.refresh();
              }}
              className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 text-sm font-black shadow-md"
            >
              GO TO DASHBOARD
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-nirmaan-black/50 font-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-nirmaan-blue font-bold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

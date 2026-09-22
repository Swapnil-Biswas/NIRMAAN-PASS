'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Users,
  Zap,
  AlertCircle,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Cpu,
  Info,
  House,
} from 'lucide-react';
import { TRACKS, TRACK_DESCRIPTIONS, Track, isValidEmail, isValidPhone } from '@/lib/registration';

type Member = { name: string; email: string; phone: string };
const emptyMember = (): Member => ({ name: '', email: '', phone: '' });

export default function RegisterPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn && data.teamId) {
          router.replace('/dashboard');
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, [router]);

  // Step 1: Account Credentials (Email & Password)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Team Details + Track Selection
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [track, setTrack] = useState<Track | ''>('');

  // Step 2: Leader Details
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');

  // Step 2: Team Members
  const [members, setMembers] = useState<Member[]>([emptyMember()]);

  // UI Feedback
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [registeredTeamName, setRegisteredTeamName] = useState('');

  const updateMember = (index: number, key: keyof Member, value: string) =>
    setMembers((current) =>
      current.map((member, i) => (i === index ? { ...member, [key]: value } : member))
    );

  const addMember = () => {
    if (members.length >= 3) {
      setError('A team can have a maximum of 4 members including the leader (1 Leader + up to 3 Members).');
      return;
    }
    setMembers((current) => [...current, emptyMember()]);
  };

  const removeMember = (index: number) => {
    setMembers((current) => current.filter((_, i) => i !== index));
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address with a proper domain extension (e.g. name@gmail.com, name@hotmail.com, name@college.edu).');
      return;
    }
    if (!password) {
      setError('Please create a password for your team account.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    // Auto sync leader email if not already modified
    if (!leaderEmail || leaderEmail === email) {
      setLeaderEmail(cleanEmail);
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validate Team Details
    if (!teamName.trim()) {
      setError('Team name is required.');
      return;
    }
    if (!college.trim()) {
      setError('College or organization is required.');
      return;
    }
    if (!track) {
      setError('Please select a problem track before submitting registration.');
      return;
    }

    // Validate Leader Details
    if (!leaderName.trim()) {
      setError('Team leader full name is required.');
      return;
    }
    if (!isValidEmail(leaderEmail)) {
      setError('Please enter a valid email address with a domain extension (.com, .in, .edu, etc.) for the team leader.');
      return;
    }
    if (!isValidPhone(leaderPhone)) {
      setError('Team leader phone must be a valid 10-digit number (not more than 10 digits).');
      return;
    }

    // Validate Members
    const filledMembers = members.filter((m) => m.name.trim() || m.email.trim() || m.phone.trim());
    for (let i = 0; i < filledMembers.length; i++) {
      const m = filledMembers[i];
      if (!m.name.trim() || !m.email.trim() || !m.phone.trim()) {
        setError(`Please fill in all details (name, email, phone) for Team Member ${i + 1}.`);
        return;
      }
      if (!isValidEmail(m.email)) {
        setError(`Please enter a valid email address with a domain extension (.com, .in, .edu, etc.) for Team Member ${i + 1}.`);
        return;
      }
      if (!isValidPhone(m.phone)) {
        setError(`Contact phone for Team Member ${i + 1} must be a valid 10-digit number.`);
        return;
      }
    }

    // Check unique emails — leader email must be unique among all member emails
    const normalizedLeaderEmail = leaderEmail.trim().toLowerCase();
    const allEmails = [normalizedLeaderEmail, ...filledMembers.map((m) => m.email.trim().toLowerCase())];
    if (new Set(allEmails).size !== allEmails.length) {
      setError('Each team member and leader must use a unique email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          college: college.trim(),
          track,
          leader: {
            name: leaderName.trim(),
            email: leaderEmail.trim().toLowerCase(),
            phone: leaderPhone.trim(),
          },
          members: filledMembers,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Registration could not be completed.');
        return;
      }

      setRegisteredTeamName(teamName.trim());
      setShowApprovalModal(true);
    } catch {
      setError('Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-nirmaan-cream flex items-center justify-center p-4">
        <div className="nirmaan-card p-8 text-center max-w-sm w-full bg-white border border-nirmaan-black/15 shadow-sm space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-nirmaan-black border-t-transparent animate-spin mx-auto" />
          <p className="font-display text-xs font-black uppercase text-nirmaan-black">
            CHECKING REGISTRATION STATUS...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-nirmaan-cream px-4 py-8 sm:py-12">
      {/* Fixed Home Button — top-left corner */}
      <Link
        href="/"
        title="Back to Home"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 bg-white border-2 border-nirmaan-black/15 hover:border-nirmaan-black text-nirmaan-black hover:bg-nirmaan-black hover:text-white transition-all rounded-full px-3.5 py-2 shadow-sm group"
      >
        <House className="w-4 h-4" />
        <span className="text-[11px] font-black uppercase hidden sm:inline">Home</span>
      </Link>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
            <Zap className="w-3 h-3 text-nirmaan-amber" /> NIRMAAN 2026
          </Link>
          <h1 className="font-display text-2xl sm:text-4xl font-black uppercase tracking-tight text-nirmaan-black">
            REGISTER YOUR TEAM
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/65 max-w-md mx-auto">
            Complete the 2-step registration to generate your official NIRMAAN 2026 Digital QR Pass.
          </p>
        </div>
        {/* 2-Step Progress Indicator */}
        <div className="flex items-center justify-between gap-2 max-w-md mx-auto px-2">
          {/* Step 1 Pill */}
          <div
            onClick={() => setCurrentStep(1)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-black uppercase transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-nirmaan-black text-white shadow-sm ring-2 ring-nirmaan-amber'
                : 'bg-white text-nirmaan-black/70 border border-nirmaan-black/15'
            }`}
          >
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] flex-shrink-0">
              1
            </span>
            <span className="truncate">Account</span>
          </div>

          <div className="h-0.5 w-4 sm:w-6 bg-nirmaan-black/20 flex-shrink-0" />

          {/* Step 2 Pill */}
          <div
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-black uppercase transition-all ${
              currentStep === 2
                ? 'bg-nirmaan-black text-white shadow-sm ring-2 ring-nirmaan-amber'
                : 'bg-white/60 text-nirmaan-black/40 border border-nirmaan-black/10'
            }`}
          >
            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-nirmaan-black/10 flex items-center justify-center text-[10px] flex-shrink-0">
              2
            </span>
            <span className="truncate">Team &amp; Track</span>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="nirmaan-card bg-white border-2 border-nirmaan-black shadow-lg p-4 sm:p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-nirmaan-red/10 border-2 border-nirmaan-red/30 text-nirmaan-red text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-black uppercase">REGISTRATION ERROR</p>
                <p className="font-medium mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ================= STEP 1: EMAIL & PASSWORD ================= */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-6">
              {/* MANDATORY PROMINENT STEP 1 NOTE */}
              <div className="p-4 sm:p-5 rounded-2xl bg-nirmaan-amber/15 border-2 border-nirmaan-amber text-nirmaan-black space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-display font-black text-xs sm:text-sm uppercase text-nirmaan-black">
                  <AlertTriangle className="w-4 h-4 text-nirmaan-amber flex-shrink-0" />
                  <span>IMPORTANT REGISTRATION NOTE</span>
                </div>
                <p className="text-xs sm:text-sm font-black text-nirmaan-black leading-snug">
                  “Only one team member should complete the registration form on behalf of the entire team.”
                </p>
                <p className="text-[11px] text-nirmaan-black/80 font-medium leading-relaxed">
                  The person creating this account is registering the entire team. Other team members should{' '}
                  <strong className="font-bold underline">not</strong> create separate registrations for the same team.
                </p>
              </div>

              {/* Account Credentials Fields */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-nirmaan-black/10">
                  <Mail className="w-4 h-4 text-nirmaan-blue" />
                  <h2 className="font-display text-sm font-black uppercase text-nirmaan-black">
                    ACCOUNT DETAILS (EMAIL & PASSWORD)
                  </h2>
                </div>

                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-nirmaan-blue" />
                    Team Account Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="team-leader@email.com"
                    className="reg-field font-bold"
                  />
                  <p className="text-[10px] text-nirmaan-black/50">
                    Used to sign in, receive event announcements, and access your team&apos;s digital pass.
                  </p>
                </div>

                {/* Password Fields */}
                <div className="grid sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-nirmaan-blue" />
                      Account Password *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="reg-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-nirmaan-black/40 hover:text-nirmaan-black"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-nirmaan-blue" />
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="reg-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-nirmaan-black/40 hover:text-nirmaan-black cursor-pointer"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Step Button */}
              <div className="pt-4 border-t border-nirmaan-black/10">
                <button
                  type="submit"
                  className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span className="sm:hidden">CONTINUE TO DETAILS</span>
                  <span className="hidden sm:inline">CONTINUE TO TEAM & MEMBER DETAILS</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </button>
              </div>

              <div className="text-center text-xs text-nirmaan-black/60 pt-2">
                Already registered your team?{' '}
                <Link href="/login" className="text-nirmaan-blue font-bold hover:underline">
                  Sign in with registered email ➔
                </Link>
              </div>
            </form>
          )}

          {/* ================= STEP 2: TEAM DETAILS + TRACK + LEADER + MEMBERS ================= */}
          {currentStep === 2 && (
            <form onSubmit={submit} className="space-y-7">
              {/* Account Summary Banner */}
              <div className="p-3.5 rounded-xl bg-nirmaan-cream/70 border border-nirmaan-black/15 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                  <span className="font-bold text-nirmaan-black/60 uppercase text-[10px] block">
                    Account Email
                  </span>
                  <span className="font-black text-nirmaan-black">
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-nirmaan-blue hover:underline"
                >
                  Change Email / Password
                </button>
              </div>

              {/* 1. Team Details & Problem Track Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-nirmaan-black/10">
                  <Users className="w-4 h-4 text-nirmaan-orange" />
                  <h2 className="font-display text-sm font-black uppercase text-nirmaan-black">
                    1. TEAM DETAILS & PROBLEM TRACK
                  </h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70">
                      Team Name *
                    </label>
                    <input
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. CyberVanguard"
                      className="reg-field font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70">
                      College / University / Organization *
                    </label>
                    <input
                      required
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. BMSIT & Management"
                      className="reg-field"
                    />
                  </div>
                </div>

                {/* Problem Track Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center justify-between">
                    <span>Problem Track Selection *</span>
                    <span className="text-[10px] text-nirmaan-red font-black">REQUIRED</span>
                  </label>
                  <select
                    required
                    value={track}
                    onChange={(e) => setTrack(e.target.value as Track)}
                    className="reg-field font-bold text-xs cursor-pointer"
                  >
                    <option value="">-- Select your official problem track --</option>
                    {TRACKS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  {/* Track Context & Description Card */}
                  {track && (
                    <div
                      className={`p-3.5 rounded-xl border-2 text-xs transition-all animate-in fade-in duration-200 ${
                        track === 'Open Innovation'
                          ? 'bg-nirmaan-purple/10 border-nirmaan-purple text-nirmaan-purple-dark'
                          : 'bg-nirmaan-blue/10 border-nirmaan-blue/40 text-nirmaan-black'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] mb-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Track Scope: {track}</span>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed">
                        {TRACK_DESCRIPTIONS[track]}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Team Leader Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-nirmaan-black/10">
                  <UserRound className="w-4 h-4 text-nirmaan-blue" />
                  <h2 className="font-display text-sm font-black uppercase text-nirmaan-black">
                    2. TEAM LEADER DETAILS
                  </h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70">
                      Leader Full Name *
                    </label>
                    <input
                      required
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="reg-field font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-nirmaan-blue" />
                      Leader Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      value={leaderEmail}
                      onChange={(e) => setLeaderEmail(e.target.value)}
                      placeholder="leader@email.com"
                      className="reg-field"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-nirmaan-black/70 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-nirmaan-blue" />
                      Leader Contact Phone *
                    </span>
                    <span className="text-[10px] text-nirmaan-black/40 font-mono">10 digits max</span>
                  </label>
                  <input
                    required
                    type="tel"
                    maxLength={10}
                    value={leaderPhone}
                    onChange={(e) => setLeaderPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    className="reg-field font-mono"
                  />
                </div>
              </div>

              {/* 3. Team Member Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-nirmaan-black/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-nirmaan-green-dark" />
                    <h2 className="font-display text-sm font-black uppercase text-nirmaan-black">
                      3. ADDITIONAL TEAM MEMBERS ({members.length}/3)
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold text-nirmaan-black/50 uppercase">
                    Total Team Size: {1 + members.length}/4
                  </span>
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-4 px-3 rounded-2xl border border-dashed border-nirmaan-black/20 bg-nirmaan-cream/30 text-nirmaan-black/70 text-xs">
                    <p className="font-bold">Leader Only (Solo Registration)</p>
                    <p className="text-[11px] text-nirmaan-black/50 mt-0.5">
                      If you have more teammates, click below to add up to 3 additional members.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-nirmaan-black/15 bg-nirmaan-cream/40 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase text-nirmaan-black">
                            TEAM MEMBER #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMember(index)}
                            className="p-1 text-nirmaan-red/70 hover:text-nirmaan-red hover:bg-nirmaan-red/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <input
                          required
                          value={member.name}
                          onChange={(e) => updateMember(index, 'name', e.target.value)}
                          placeholder="Member full name"
                          className="reg-field text-xs"
                        />

                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            required
                            type="email"
                            value={member.email}
                            onChange={(e) => updateMember(index, 'email', e.target.value)}
                            placeholder="Member email address (e.g. member@gmail.com)"
                            className="reg-field text-xs"
                          />
                          <input
                            required
                            type="tel"
                            maxLength={10}
                            value={member.phone}
                            onChange={(e) =>
                              updateMember(index, 'phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                            }
                            placeholder="10-digit mobile number"
                            className="reg-field text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {members.length < 3 && (
                  <button
                    type="button"
                    onClick={addMember}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-nirmaan-black/20 hover:border-nirmaan-black text-xs font-black uppercase text-nirmaan-blue hover:bg-nirmaan-blue/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Another Team Member
                  </button>
                )}
              </div>

              {/* Complete Registration & Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-nirmaan-black/10">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={loading}
                  className="nirmaan-btn nirmaan-btn-outline w-full sm:w-auto py-3.5 px-6 text-xs font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK TO STEP 1</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="nirmaan-btn nirmaan-btn-primary flex-1 w-full py-3.5 text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                      </svg>
                      <span className="sm:hidden">GENERATING PASS...</span>
                      <span className="hidden sm:inline">REGISTERING TEAM &amp; GENERATING PASS...</span>
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                      <span className="sm:hidden">SUBMIT REGISTRATION</span>
                      <span className="hidden sm:inline">SUBMIT REGISTRATION &amp; CREATE EVENT PASS</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ================= REGISTRATION SUCCESS & APPROVAL MODAL ================= */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nirmaan-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="nirmaan-card max-w-lg w-full bg-white border-2 border-nirmaan-black shadow-2xl p-4 sm:p-8 space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-200 text-center max-h-[92vh] overflow-y-auto">
            {/* Celebration Emblem */}
            <div className="w-16 h-16 rounded-full bg-nirmaan-green-bright border-2 border-nirmaan-black flex items-center justify-center mx-auto shadow-md">
              <Sparkles className="w-8 h-8 text-nirmaan-black" />
            </div>

            <div className="space-y-2">
              <span className="nirmaan-pill bg-nirmaan-amber text-nirmaan-black text-[10px] font-black uppercase">
                AWAITING ORGANIZER APPROVAL
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-nirmaan-black">
                REGISTRATION SUBMITTED!
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/75">
                Thank you for registering team <strong className="text-nirmaan-black font-black uppercase underline">{registeredTeamName || 'your team'}</strong> for NIRMAAN 2026.
              </p>
            </div>

            {/* Instruction Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-nirmaan-cream/80 border-2 border-nirmaan-black/15 text-left space-y-2.5">
              <div className="flex items-center gap-2 font-display text-xs font-black uppercase text-nirmaan-black">
                <ShieldCheck className="w-4 h-4 text-nirmaan-blue flex-shrink-0" />
                <span>WHAT HAPPENS NEXT?</span>
              </div>
              <ul className="text-xs font-medium text-nirmaan-black/80 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  <strong>Organizer Approval:</strong> The organizing team will review and approve your registration shortly.
                </li>
                <li>
                  <strong>Digital QR Pass Unlock:</strong> Once approved, your team's official <strong>Digital QR Pass</strong> will be unlocked on your dashboard.
                </li>
                <li>
                  <strong>Event Day On-Desk Registration:</strong> On the day of the event, present your approved QR Pass at the venue desk for on-desk physical check-in and meal access.
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  router.push('/dashboard');
                  router.refresh();
                }}
                className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 text-xs font-black uppercase shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>GO TO DASHBOARD</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  router.push('/pass');
                  router.refresh();
                }}
                className="nirmaan-btn nirmaan-btn-outline w-full py-3.5 text-xs font-black uppercase border-2 border-nirmaan-black/20 hover:border-nirmaan-black cursor-pointer"
              >
                <span>CHECK PASS STATUS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

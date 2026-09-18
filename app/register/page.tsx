'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Mail, Phone, Plus, Trash2, UserRound, Users, Zap, AlertCircle } from 'lucide-react';
import { TRACKS } from '@/lib/registration';

type Member = { name: string; email: string; phone: string };
const emptyMember = (): Member => ({ name: '', email: '', phone: '' });

export default function RegisterPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [track, setTrack] = useState('');
  const [leader, setLeader] = useState<Member>(emptyMember());
  const [members, setMembers] = useState<Member[]>([emptyMember()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateLeader = (key: keyof Member, value: string) => setLeader((current) => ({ ...current, [key]: value }));
  const updateMember = (index: number, key: keyof Member, value: string) =>
    setMembers((current) => current.map((member, i) => (i === index ? { ...member, [key]: value } : member)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, college, track, leader, members }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message || 'Registration could not be completed.');
        return;
      }
      router.push('/pass');
      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const memberFields = (member: Member, index: number) => (
    <div key={index} className="rounded-xl border border-nirmaan-black/10 bg-nirmaan-cream/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase">TEAM MEMBER {index + 1}</p>
        {members.length > 1 && (
          <button type="button" onClick={() => setMembers((current) => current.filter((_, i) => i !== index))} className="text-nirmaan-red">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <input required value={member.name} onChange={(event) => updateMember(index, 'name', event.target.value)} placeholder="Full name" className="field" />
      <div className="grid sm:grid-cols-2 gap-3">
        <input required type="email" value={member.email} onChange={(event) => updateMember(index, 'email', event.target.value)} placeholder="Email address" className="field" />
        <input required type="tel" value={member.phone} onChange={(event) => updateMember(index, 'phone', event.target.value)} placeholder="Phone number" className="field" />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-nirmaan-cream px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
            <Zap className="w-3 h-3 text-nirmaan-amber" /> NIRMAAN 2026
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase">REGISTER YOUR TEAM</h1>
          <p className="text-sm text-nirmaan-black/60">Complete the details below. Your digital QR pass will be created after registration.</p>
        </div>

        <form onSubmit={submit} className="nirmaan-card bg-white border-2 border-nirmaan-black/10 p-6 sm:p-8 space-y-7">
          {error && <div className="p-3 rounded-xl bg-nirmaan-red/10 border border-nirmaan-red/30 text-nirmaan-red text-xs font-bold flex gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-black uppercase flex items-center gap-2"><Users className="w-5 h-5" /> TEAM DETAILS</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" className="field" />
              <input required value={college} onChange={(event) => setCollege(event.target.value)} placeholder="College / organization" className="field" />
            </div>
            <select required value={track} onChange={(event) => setTrack(event.target.value)} className="field">
              <option value="">Select problem track</option>
              {TRACKS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-black uppercase flex items-center gap-2"><UserRound className="w-5 h-5" /> TEAM LEADER</h2>
            <input required value={leader.name} onChange={(event) => updateLeader('name', event.target.value)} placeholder="Leader full name" className="field" />
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="relative"><Mail className="icon" /><input required type="email" value={leader.email} onChange={(event) => updateLeader('email', event.target.value)} placeholder="Leader email" className="field pl-10" /></label>
              <label className="relative"><Phone className="icon" /><input required type="tel" value={leader.phone} onChange={(event) => updateLeader('phone', event.target.value)} placeholder="Leader phone" className="field pl-10" /></label>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-black uppercase">TEAM MEMBERS</h2>
            {members.map(memberFields)}
            <button type="button" onClick={() => setMembers((current) => [...current, emptyMember()])} className="text-xs font-black uppercase text-nirmaan-blue flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add another member
            </button>
          </section>

          <button disabled={loading} className="nirmaan-btn nirmaan-btn-primary w-full py-3.5 font-black disabled:opacity-50">
            {loading ? 'CREATING YOUR PASS...' : <>REGISTER & CREATE QR PASS <ArrowRight className="w-4 h-4" /></>}
          </button>
          <p className="text-center text-xs text-nirmaan-black/50">Already registered? <Link href="/login" className="text-nirmaan-blue font-bold hover:underline">Access your pass with the leader email</Link></p>
        </form>
      </div>
      <style jsx>{`.field{width:100%;border:1px solid rgb(0 0 0 / .2);border-radius:.75rem;padding:.75rem .9rem;font-size:.875rem;outline:none;background:white}.field:focus{border-color:#111827;box-shadow:0 0 0 2px rgb(245 158 11 / .25)}.icon{position:absolute;left:.8rem;top:50%;transform:translateY(-50%);width:1rem;height:1rem;opacity:.45}`}</style>
    </main>
  );
}

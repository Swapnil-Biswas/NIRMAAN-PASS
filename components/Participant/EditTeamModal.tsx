'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Team, Member } from '@/types/database';
import { isValidEmail, isValidPhone } from '@/lib/registration';
import {
  Edit3,
  Users,
  Building2,
  Layers,
  User,
  Mail,
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';

interface EditTeamModalProps {
  team: Team;
  members: Member[];
  onUpdated?: () => void;
  buttonClassName?: string;
  buttonLabel?: string;
}

export default function EditTeamModal({
  team,
  members,
  onUpdated,
  buttonClassName,
  buttonLabel = 'EDIT TEAM DETAILS',
}: EditTeamModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [teamName, setTeamName] = useState(team.team_name || '');
  const [college, setCollege] = useState(team.college || '');

  // Separate leader from rest of members
  const initialLeader = members[0] || { name: '', email: '', phone: '' };
  const initialMembers = members.slice(1).map((m) => ({
    name: m.name || '',
    phone: m.phone || '',
  }));

  const [leader, setLeader] = useState({
    name: initialLeader.name || '',
    email: initialLeader.email || '',
    phone: initialLeader.phone || '',
  });

  const [additionalMembers, setAdditionalMembers] = useState(initialMembers);

  const resetFormToCurrent = () => {
    setTeamName(team.team_name || '');
    setCollege(team.college || '');
    setLeader({
      name: members[0]?.name || '',
      email: members[0]?.email || '',
      phone: members[0]?.phone || '',
    });
    setAdditionalMembers(
      members.slice(1).map((m) => ({
        name: m.name || '',
        phone: m.phone || '',
      }))
    );
    setError('');
    setSuccess('');
  };

  const handleOpen = () => {
    resetFormToCurrent();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setError('');
    setSuccess('');
  };

  const handleAddMember = () => {
    if (additionalMembers.length < 3) {
      setAdditionalMembers([...additionalMembers, { name: '', phone: '' }]);
    }
  };

  const handleRemoveMember = (index: number) => {
    setAdditionalMembers(additionalMembers.filter((_, i) => i !== index));
  };

  const handleMemberChange = (
    index: number,
    field: 'name' | 'phone',
    value: string
  ) => {
    const updated = [...additionalMembers];
    updated[index][field] = value;
    setAdditionalMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!teamName.trim()) {
      setError('Team name is required.');
      return;
    }
    if (!college.trim()) {
      setError('College / Institution is required.');
      return;
    }
    if (!leader.name.trim() || !leader.email.trim() || !leader.phone.trim()) {
      setError('Complete team leader details (name, email, phone) are required.');
      return;
    }
    if (!isValidEmail(leader.email)) {
      setError('Please provide a valid leader email address with a domain extension (.com, .in, .edu, etc.).');
      return;
    }
    if (!isValidPhone(leader.phone)) {
      setError('Leader phone must be a valid 10-digit mobile number.');
      return;
    }

    for (let i = 0; i < additionalMembers.length; i++) {
      const m = additionalMembers[i];
      if (!m.name.trim() || !m.phone.trim()) {
        setError(`Please fill name and phone number for Member ${i + 2}, or remove the entry.`);
        return;
      }
      if (!isValidPhone(m.phone)) {
        setError(`Phone for Member ${i + 2} must be a valid 10-digit number.`);
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/team/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          token: team.qr_token,
          teamName: teamName.trim(),
          college: college.trim(),
          track: team.track,
          leader,
          members: additionalMembers.map((m) => ({
            name: m.name.trim(),
            phone: m.phone.trim(),
            email: '',
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update team details.');
      }

      setSuccess('Team details updated successfully!');
      setTimeout(() => {
        setIsOpen(false);
        router.refresh();
        if (onUpdated) onUpdated();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error updating team details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          buttonClassName ||
          'nirmaan-pill bg-white hover:bg-nirmaan-cream text-nirmaan-black border border-nirmaan-black/20 text-xs py-2 px-4 font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer'
        }
      >
        <Edit3 className="w-3.5 h-3.5 text-nirmaan-blue" />
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-nirmaan-black/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-nirmaan-black rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-nirmaan-black/10 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-nirmaan-blue flex-shrink-0" />
                <h3 className="font-display text-base sm:text-lg font-black uppercase text-nirmaan-black">
                  EDIT TEAM DETAILS
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-nirmaan-black/50 hover:text-nirmaan-black font-bold text-lg px-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications */}
            {error && (
              <div className="p-3.5 bg-nirmaan-red/10 border border-nirmaan-red/30 rounded-xl text-xs font-bold text-nirmaan-red flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3.5 bg-nirmaan-green-bright/20 border border-nirmaan-green-dark/30 rounded-xl text-xs font-bold text-nirmaan-green-dark flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Team Information */}
              <div className="space-y-4">
                <h4 className="font-display text-xs font-black uppercase tracking-wider text-nirmaan-black/70 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-nirmaan-blue" />
                  1. TEAM INFORMATION
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-nirmaan-black mb-1">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Byte Crafters"
                      className="w-full px-3.5 py-2.5 bg-nirmaan-cream/40 border border-nirmaan-black/20 rounded-xl font-medium text-xs text-nirmaan-black focus:border-nirmaan-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-nirmaan-black mb-1">
                      College / University *
                    </label>
                    <input
                      type="text"
                      required
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. BMS Institute of Technology"
                      className="w-full px-3.5 py-2.5 bg-nirmaan-cream/40 border border-nirmaan-black/20 rounded-xl font-medium text-xs text-nirmaan-black focus:border-nirmaan-black focus:outline-none"
                    />
                  </div>
                </div>

                {team.track && (
                  <div className="bg-nirmaan-cream/60 border border-nirmaan-black/10 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-nirmaan-black/50 block">
                        Assigned Problem Track
                      </span>
                      <span className="text-xs font-black text-nirmaan-blue">
                        {team.track}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-nirmaan-blue/10 text-nirmaan-blue px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Section 2: Team Leader Details */}
              <div className="space-y-3.5 pt-4 border-t border-nirmaan-black/10">
                <h4 className="font-display text-xs font-black uppercase tracking-wider text-nirmaan-black/70 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-nirmaan-blue" />
                  2. TEAM LEADER (PRIMARY CONTACT)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-nirmaan-black/70 mb-1">
                      Leader Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={leader.name}
                      onChange={(e) => setLeader({ ...leader, name: e.target.value })}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 bg-white border border-nirmaan-black/20 rounded-xl text-xs font-medium focus:border-nirmaan-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-nirmaan-black/70 mb-1">
                      Leader Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={leader.email}
                      onChange={(e) => setLeader({ ...leader, email: e.target.value })}
                      placeholder="leader@college.edu"
                      className="w-full px-3 py-2 bg-white border border-nirmaan-black/20 rounded-xl text-xs font-medium focus:border-nirmaan-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-nirmaan-black/70 mb-1">
                      Leader Phone * <span className="font-mono text-[9px] text-nirmaan-black/40">(10 digits max)</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={leader.phone}
                      onChange={(e) => setLeader({ ...leader, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 bg-white border border-nirmaan-black/20 rounded-xl text-xs font-mono focus:border-nirmaan-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Additional Team Members */}
              <div className="space-y-3.5 pt-4 border-t border-nirmaan-black/10">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-black uppercase tracking-wider text-nirmaan-black/70 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-nirmaan-blue" />
                    3. TEAM MEMBERS ({1 + additionalMembers.length}/4 Total)
                  </h4>

                  {additionalMembers.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="nirmaan-pill bg-nirmaan-blue text-white text-[10px] font-black py-1 px-3 hover:opacity-90 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      ADD MEMBER
                    </button>
                  )}
                </div>

                {additionalMembers.length === 0 ? (
                  <p className="text-xs text-nirmaan-black/50 italic py-2">
                    No additional team members added. (Teams can have up to 4 total members).
                  </p>
                ) : (
                  <div className="space-y-3">
                    {additionalMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-nirmaan-black/15 bg-nirmaan-cream/30 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-nirmaan-black">
                            MEMBER {idx + 2}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="text-nirmaan-red hover:opacity-80 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            required
                            value={member.name}
                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="w-full px-3 py-2 bg-white border border-nirmaan-black/20 rounded-xl text-xs font-medium focus:border-nirmaan-black focus:outline-none"
                          />
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={member.phone}
                            onChange={(e) =>
                              handleMemberChange(idx, 'phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                            }
                            placeholder="10-digit mobile"
                            className="w-full px-3 py-2 bg-white border border-nirmaan-black/20 rounded-xl text-xs font-mono focus:border-nirmaan-black focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-nirmaan-black/10">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleClose}
                  className="px-4 py-2.5 text-xs font-bold uppercase text-nirmaan-black/60 hover:text-nirmaan-black cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="nirmaan-btn nirmaan-btn-primary text-xs py-2.5 px-6 font-black shadow-xs flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>SAVING CHANGES...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>SAVE CHANGES</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

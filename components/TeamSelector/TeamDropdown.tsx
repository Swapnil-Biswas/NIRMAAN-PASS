'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Team } from '@/types/database';

interface TeamDropdownProps {
  teams: Team[];
  currentQrToken: string;
  basePath: '/dashboard' | '/pass';
}

export default function TeamDropdown({ teams, currentQrToken, basePath }: TeamDropdownProps) {
  const router = useRouter();

  // Primary demo teams for quick 1-click testing
  const demoTokens = ['nirmaan_alpha_9281a', 'nirmaan_beta_4812b', 'nirmaan_gamma_7723c'];
  const demoTeams = teams.filter((t) => demoTokens.includes(t.qr_token));
  const otherTeams = teams.filter((t) => !demoTokens.includes(t.qr_token));

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-2xl sm:rounded-full border border-nirmaan-black/15 shadow-sm text-xs font-semibold max-w-full">
      <span className="text-nirmaan-black/50 uppercase font-bold text-[10px]">SWITCH:</span>
      
      {/* Quick Demo Team Pills */}
      <div className="flex items-center gap-1">
        {demoTeams.map((t) => {
          const label = t.team_name.split(' ')[1] || t.team_name;
          const isActive = t.qr_token === currentQrToken;
          return (
            <Link
              key={t.id}
              href={`${basePath}?token=${t.qr_token}`}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase transition-colors ${
                isActive
                  ? 'bg-nirmaan-black text-white'
                  : 'hover:bg-nirmaan-cream text-nirmaan-black/80'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Dropdown for All 289 Teams */}
      {otherTeams.length > 0 && (
        <div className="flex items-center gap-1 border-l border-nirmaan-black/15 pl-2">
          <select
            value={demoTokens.includes(currentQrToken) ? '' : currentQrToken}
            onChange={(e) => {
              if (e.target.value) {
                router.push(`${basePath}?token=${e.target.value}`);
              }
            }}
            className="bg-transparent text-[11px] font-bold uppercase text-nirmaan-black outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
            title="Select any participating team"
          >
            <option value="" disabled>
              All Teams ({otherTeams.length})...
            </option>
            {otherTeams.map((t) => (
              <option key={t.id} value={t.qr_token}>
                {t.team_name} ({t.college})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

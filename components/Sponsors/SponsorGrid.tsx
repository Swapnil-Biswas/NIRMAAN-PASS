'use client';

import React, { useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

interface SponsorItem {
  name: string;
  category: string;
  tagColor: string;
  textColor: string;
  logo: string;
  url: string;
  description: string;
  darkBg?: boolean;
}

const sponsors: SponsorItem[] = [
  {
    name: 'MASTRY HUB',
    category: 'TITLE & PLATFORM PARTNER',
    tagColor: 'bg-nirmaan-amber',
    textColor: 'text-nirmaan-black',
    logo: '/sponsors/mastryhub.png',
    url: 'https://mastryhub.com/event/nirmaan-2026',
    description: 'Official hackathon hosting platform, team submissions, and problem statements.',
    darkBg: false,
  },
  {
    name: 'RESKILLL',
    category: 'COMMUNITY & TECH PARTNER',
    tagColor: 'bg-nirmaan-purple',
    textColor: 'text-white',
    logo: '/sponsors/reskilll.png',
    url: 'https://reskilll.com/',
    description: 'Empowering student developers with mentorship, developer communities, and hackathon workshops.',
    darkBg: true,
  },
  {
    name: 'MONSTER ENERGY',
    category: 'OFFICIAL BEVERAGE PARTNER',
    tagColor: 'bg-nirmaan-green-bright',
    textColor: 'text-nirmaan-black',
    logo: '/sponsors/monster-energy.png',
    url: 'https://www.monsterenergy.com/',
    description: 'Fueling 36 hours of non-stop hacking with unlimited energy drinks and beverages.',
    darkBg: false,
  },
];

function SponsorCard({ sponsor, className = '' }: { sponsor: SponsorItem; className?: string }) {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group nirmaan-card p-5 sm:p-6 bg-white border-2 border-nirmaan-black/10 hover:border-nirmaan-black flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-lg shadow-sm ${className}`}
    >
      <div>
        {/* Category Pill Tag */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className={`nirmaan-pill ${sponsor.tagColor} ${sponsor.textColor} text-[10px] font-black whitespace-nowrap`}>
            {sponsor.category}
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-nirmaan-black/40 group-hover:text-nirmaan-black transition-colors shrink-0" />
        </div>

        {/* Logo Presentation Box */}
        <div
          className={`h-24 w-full rounded-2xl flex items-center justify-center p-4 mb-4 transition-transform group-hover:scale-102 ${
            sponsor.darkBg ? 'bg-nirmaan-black' : 'bg-nirmaan-cream/40 border border-nirmaan-black/5'
          }`}
        >
          <img
            src={sponsor.logo}
            alt={sponsor.name}
            className="max-h-16 max-w-[85%] object-contain filter drop-shadow-xs"
          />
        </div>

        {/* Title & Description */}
        <h4 className="font-display text-lg font-black uppercase text-nirmaan-black group-hover:text-nirmaan-blue transition-colors">
          {sponsor.name}
        </h4>
        <p className="text-xs font-medium text-nirmaan-black/70 leading-relaxed mt-1.5">
          {sponsor.description}
        </p>
      </div>

      {/* Visit link */}
      <div className="mt-4 pt-3 border-t border-nirmaan-black/10 flex items-center justify-between text-xs font-bold text-nirmaan-black group-hover:text-nirmaan-amber transition-colors">
        <span>VISIT PARTNER</span>
        <span>➔</span>
      </div>
    </a>
  );
}

export default function SponsorGrid() {
  const [isPaused, setIsPaused] = useState(false);

  // 4 sets of sponsors = 2 identical halves of 6 cards for an infinite, seamless loop
  const marqueeSponsors = [...sponsors, ...sponsors, ...sponsors, ...sponsors];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
              <Sparkles className="w-3 h-3 text-nirmaan-amber" />
              NIRMAAN 2026 PARTNERS
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-nirmaan-black">
            POWERED BY OUR SPONSORS
          </h3>
        </div>
        <span className="text-xs font-bold text-nirmaan-black/60 hidden sm:inline">
          Special thanks to our sponsors
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-nirmaan-black/60 sm:hidden flex items-center gap-1.5 bg-nirmaan-black/5 px-2.5 py-1 rounded-full">
          <span className="live-dot w-1.5 h-1.5 bg-nirmaan-green-bright" />
          Auto-Moving
        </span>
      </div>

      {/* Mobile: Automatically moving infinite marquee */}
      <div
        className="md:hidden overflow-hidden -mx-4 px-4 py-2"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div
          className="flex gap-4 w-max animate-marquee-mobile"
          style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
        >
          {marqueeSponsors.map((sponsor, idx) => (
            <SponsorCard
              key={idx}
              sponsor={sponsor}
              className="w-[78vw] max-w-[300px] min-w-[260px] shrink-0"
            />
          ))}
        </div>
      </div>

      {/* Desktop: Static 3-column side-by-side grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {sponsors.map((sponsor, idx) => (
          <SponsorCard key={idx} sponsor={sponsor} />
        ))}
      </div>
    </div>
  );
}

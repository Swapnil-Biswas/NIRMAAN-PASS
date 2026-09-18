'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SponsorItem {
  name: string;
  category: string;
  tagColor: string;
  textColor: string;
  logo: string;
  description: string;
  darkBg?: boolean;
}

export default function SponsorGrid() {
  const sponsors: SponsorItem[] = [
    {
      name: 'MASTRY HUB',
      category: 'TITLE & PLATFORM PARTNER',
      tagColor: 'bg-nirmaan-amber',
      textColor: 'text-nirmaan-black',
      logo: '/sponsors/mastryhub.png',
      description: 'Official hackathon hosting platform, team submissions, and problem statements.',
      darkBg: false,
    },
    {
      name: 'RESKILLL',
      category: 'COMMUNITY & TECH PARTNER',
      tagColor: 'bg-nirmaan-purple',
      textColor: 'text-white',
      logo: '/sponsors/reskilll.png',
      description: 'Empowering student developers with mentorship, developer communities, and hackathon workshops.',
      darkBg: true,
    },
    {
      name: 'MONSTER ENERGY',
      category: 'OFFICIAL BEVERAGE PARTNER',
      tagColor: 'bg-nirmaan-green-bright',
      textColor: 'text-nirmaan-black',
      logo: '/sponsors/monster-energy.png',
      description: 'Fueling 25 hours of non-stop hacking with unlimited energy drinks and beverages.',
      darkBg: false,
    },
  ];

  const [isPaused, setIsPaused] = useState(false);
  const marqueeSponsors = [...sponsors, ...sponsors, ...sponsors, ...sponsors];

  return (
    <div className="w-full">
      {/* Header — 100% original untouched */}
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
      </div>

      {/* MOBILE ONLY (< md): Auto-moving continuous marquee */}
      <div
        className="md:hidden overflow-hidden -mx-4 px-4 py-2"
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div
          className="flex gap-4 w-max animate-marquee-mobile"
          style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
        >
          {marqueeSponsors.map((sponsor, idx) => (
            <div
              key={idx}
              className="nirmaan-card p-5 bg-white border-2 border-nirmaan-black/10 flex flex-col justify-between w-[78vw] max-w-[300px] min-w-[260px] shrink-0 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`nirmaan-pill ${sponsor.tagColor} ${sponsor.textColor} text-[10px] font-black whitespace-nowrap`}>
                    {sponsor.category}
                  </span>
                </div>

                <div
                  className={`h-20 w-full rounded-2xl flex items-center justify-center p-3 mb-3 ${
                    sponsor.darkBg ? 'bg-nirmaan-black' : 'bg-nirmaan-cream/40 border border-nirmaan-black/5'
                  }`}
                >
                  <img
                    src={sponsor.logo}
                    alt={sponsor.name}
                    className="max-h-12 max-w-[85%] object-contain"
                  />
                </div>

                <h4 className="font-display text-base font-black uppercase text-nirmaan-black">
                  {sponsor.name}
                </h4>
                <p className="text-xs font-medium text-nirmaan-black/70 leading-relaxed mt-1">
                  {sponsor.description}
                </p>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* DESKTOP / MONITOR ONLY (md+): WIDER & BROADER CARDS */}
      <div className="hidden md:grid md:grid-cols-3 gap-6 lg:gap-8 w-full">
        {sponsors.map((sponsor, idx) => (
          <div
            key={idx}
            className="nirmaan-card p-6 lg:p-8 bg-white border-2 border-nirmaan-black/10 flex flex-col justify-between w-full"
          >
            <div>
              {/* Category Pill Tag */}
              <div className="flex items-center justify-between gap-2 mb-5">
                <span className={`nirmaan-pill ${sponsor.tagColor} ${sponsor.textColor} text-xs font-black`}>
                  {sponsor.category}
                </span>
              </div>

              {/* Logo Presentation Box */}
              <div
                className={`h-28 lg:h-32 w-full rounded-2xl flex items-center justify-center p-5 mb-5 transition-transform group-hover:scale-102 ${
                  sponsor.darkBg ? 'bg-nirmaan-black' : 'bg-nirmaan-cream/40 border border-nirmaan-black/5'
                }`}
              >
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="max-h-16 lg:max-h-20 max-w-[85%] object-contain filter drop-shadow-xs"
                />
              </div>

              {/* Title & Description */}
              <h4 className="font-display text-xl lg:text-2xl font-black uppercase text-nirmaan-black">
                {sponsor.name}
              </h4>
              <p className="text-xs lg:text-sm font-medium text-nirmaan-black/70 leading-relaxed mt-2">
                {sponsor.description}
              </p>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

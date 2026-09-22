import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Instagram, Linkedin, MessageCircle, Share2, Sparkles } from 'lucide-react';

export default function SocialsPage() {
  const clubs = [
    {
      name: 'Coding Club',
      tag: 'CC',
      tagColor: 'bg-nirmaan-purple',
      college: 'BMSIT Coding Club — Build, Learn, Ship.',
      logo: '/organizers/coding-club.png',
      links: [
        {
          title: 'Instagram',
          url: 'https://www.instagram.com/codingclub_bmsit/',
          handle: '@codingclub_bmsit',
          icon: Instagram,
          hoverColor: 'hover:bg-nirmaan-red',
        },
        {
          title: 'LinkedIn',
          url: 'https://www.linkedin.com/in/codingclub-bmsit/',
          handle: 'codingclub-bmsit',
          icon: Linkedin,
          hoverColor: 'hover:bg-nirmaan-blue',
        },
        {
          title: 'WhatsApp Community',
          url: 'https://chat.whatsapp.com/KkXQRuFjlCnCLuYV7G24Vf',
          handle: 'Join Official WhatsApp Hub',
          icon: MessageCircle,
          hoverColor: 'hover:bg-nirmaan-green-dark',
        },
      ],
    },
    {
      name: 'Alterino',
      tag: 'AL',
      tagColor: 'bg-nirmaan-orange',
      college: 'BMSIT Alterino — Hardware, Innovation, Impact.',
      logo: '/organizers/alterino.jpg',
      links: [
        {
          title: 'Instagram',
          url: 'https://www.instagram.com/alterino_bmsit/',
          handle: '@alterino_bmsit',
          icon: Instagram,
          hoverColor: 'hover:bg-nirmaan-red',
        },
        {
          title: 'LinkedIn',
          url: 'https://www.linkedin.com/company/alterino/posts/?feedView=all',
          handle: 'alterino',
          icon: Linkedin,
          hoverColor: 'hover:bg-nirmaan-blue',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-nirmaan-cream flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-nirmaan-black/70 hover:text-nirmaan-black mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO LOBBY
            </Link>
            <h1 className="font-display text-2xl sm:text-5xl font-black uppercase text-nirmaan-black">
              SOCIALS &amp; COMMUNITIES
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-nirmaan-black/70 mt-1">
              Follow our organizing clubs & stay connected throughout NIRMAAN 2026
            </p>
          </div>
        </div>

        {/* Clubs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {clubs.map((club, idx) => (
            <div
              key={idx}
              className="nirmaan-card p-4 sm:p-8 bg-white border-2 border-nirmaan-black/15 shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Club Header with Logo */}
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-nirmaan-black/10">
                  <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-black border border-nirmaan-black/15 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                    <img
                      src={club.logo}
                      alt={club.name}
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h2 className="font-display text-lg sm:text-xl font-black uppercase text-nirmaan-black">
                        {club.name}
                      </h2>
                      <span className={`nirmaan-pill ${club.tagColor} text-white text-[9px] font-black px-2 py-0.5`}>
                        {club.tag}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-nirmaan-black/60">
                      {club.college}
                    </p>
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-3">
                  {club.links.map((link, lIdx) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={lIdx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between p-3.5 rounded-2xl bg-nirmaan-cream/40 hover:bg-nirmaan-cream border border-nirmaan-black/10 hover:border-nirmaan-black transition-all duration-150 hover:shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nirmaan-black text-white ${link.hoverColor} transition-colors shadow-xs`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-display text-sm uppercase font-black text-nirmaan-black block truncate">
                              {link.title}
                            </span>
                            <span className="text-[11px] font-semibold text-nirmaan-black/50 block truncate">
                              {link.handle}
                            </span>
                          </div>
                        </div>

                        <ExternalLink className="w-4 h-4 text-nirmaan-black/30 group-hover:text-nirmaan-black transition-colors shrink-0 ml-2" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

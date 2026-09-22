import React from 'react';
import Link from 'next/link';
import { Users, Instagram, Linkedin, MessageCircle, ExternalLink } from 'lucide-react';

interface OrganizerClub {
  name: string;
  role: string;
  college: string;
  logo: string;
  description: string;
  tagColor: string;
  textColor: string;
  links: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export default function OrganizersSection() {
  const organizers: OrganizerClub[] = [
    {
      name: 'Coding Club BMSIT',
      role: 'ORGANIZING CLUB',
      college: 'BMS Institute of Technology & Management',
      logo: '/organizers/coding-club.png',
      description: 'Fostering tech culture, competitive programming, open source innovation, and hands-on hackathon experiences.',
      tagColor: 'bg-nirmaan-purple',
      textColor: 'text-white',
      links: [
        {
          title: 'Instagram',
          url: 'https://www.instagram.com/codingclub_bmsit/',
          icon: Instagram,
        },
        {
          title: 'LinkedIn',
          url: 'https://www.linkedin.com/in/codingclub-bmsit/',
          icon: Linkedin,
        },
        {
          title: 'WhatsApp Hub',
          url: 'https://chat.whatsapp.com/KkXQRuFjlCnCLuYV7G24Vf',
          icon: MessageCircle,
        },
      ],
    },
    {
      name: 'Alterino BMSIT',
      role: 'ORGANIZING CLUB',
      college: 'BMS Institute of Technology & Management',
      logo: '/organizers/alterino.jpg',
      description: 'Empowering makers and creators in hardware engineering, IoT innovations, and embedded tech developments.',
      tagColor: 'bg-nirmaan-orange',
      textColor: 'text-nirmaan-black',
      links: [
        {
          title: 'Instagram',
          url: 'https://www.instagram.com/alterino_bmsit/',
          icon: Instagram,
        },
        {
          title: 'LinkedIn',
          url: 'https://www.linkedin.com/company/alterino/posts/?feedView=all',
          icon: Linkedin,
        },
      ],
    },
  ];

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="nirmaan-pill bg-nirmaan-black text-white text-[10px] font-black">
              <Users className="w-3 h-3 text-nirmaan-amber" />
              ORGANIZING BODIES
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-nirmaan-black">
            ORGANIZED BY
          </h3>
        </div>
        <Link
          href="/socials"
          className="text-xs font-bold text-nirmaan-black/70 hover:text-nirmaan-black inline-flex items-center gap-1 transition-colors"
        >
          <span>Connect with clubs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Organizer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full">
        {organizers.map((club, idx) => (
          <div
            key={idx}
            className="nirmaan-card p-4 sm:p-6 lg:p-8 bg-white border-2 border-nirmaan-black/10 flex flex-col justify-between shadow-xs hover:border-nirmaan-black/30 transition-all"
          >
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
                <span className={`nirmaan-pill ${club.tagColor} ${club.textColor} text-[11px] sm:text-xs font-black`}>
                  {club.role}
                </span>
                <span className="text-[11px] font-bold text-nirmaan-black/50 hidden sm:inline">
                  {club.college}
                </span>
              </div>

              {/* Club Logo Presentation Box */}
              <div className="h-28 sm:h-32 lg:h-36 w-full rounded-2xl flex items-center justify-center p-3 sm:p-4 mb-4 sm:mb-5 bg-black border border-nirmaan-black/10 overflow-hidden shadow-inner">
                <img
                  src={club.logo}
                  alt={club.name}
                  className="max-h-20 sm:max-h-24 lg:max-h-28 max-w-[85%] object-contain filter drop-shadow-md rounded-lg"
                />
              </div>

              {/* Title & Description */}
              <h4 className="font-display text-lg sm:text-xl lg:text-2xl font-black uppercase text-nirmaan-black">
                {club.name}
              </h4>
              <p className="text-xs lg:text-sm font-medium text-nirmaan-black/70 leading-relaxed mt-1.5 sm:mt-2">
                {club.description}
              </p>
            </div>

            {/* Social Channels */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-nirmaan-black/10">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase text-nirmaan-black/50 shrink-0">
                Socials:
              </span>
              {club.links.map((link, lIdx) => {
                const Icon = link.icon;
                return (
                  <a
                    key={lIdx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-nirmaan-cream border border-nirmaan-black/10 hover:border-nirmaan-black text-nirmaan-black text-[11px] sm:text-xs font-bold transition-all hover:scale-105 whitespace-nowrap"
                    title={link.title}
                  >
                    <Icon className="w-3 sm:w-3.5 h-3 sm:h-3.5 flex-shrink-0" />
                    <span>{link.title}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

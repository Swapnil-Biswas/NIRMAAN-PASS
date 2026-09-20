export const TRACKS = [
  'Cyber-Physical Security & Defense',
  'Smart Mobility & Aerospace',
  'HealthTech & Bio-Wearables',
  'Deep Tech & Edge AI',
  'Agritech',
  'Open Innovation',
] as const;

export const TRACK_DESCRIPTIONS: Record<Track, string> = {
  'Cyber-Physical Security & Defense':
    'Securing critical infrastructure, IoT ecosystems, defense systems, and resilient security architectures.',
  'Smart Mobility & Aerospace':
    'Autonomous mobility, intelligent transportation systems, EV management, and aerospace innovation.',
  'HealthTech & Bio-Wearables':
    'Next-gen diagnostic systems, wearable health monitors, telemedicine, and healthcare analytics.',
  'Deep Tech & Edge AI':
    'Embedded AI, low-latency edge inference, computer vision, robotics, and foundational engineering.',
  'Agritech':
    'Precision farming, smart irrigation, crop health analytics, and sustainable agricultural ecosystems.',
  'Open Innovation':
    'Intended for hardware-aligned software solutions addressing meaningful real-world challenges, bridging software innovation with hardware-driven and physical-world applications.',
};

export type Track = (typeof TRACKS)[number];

export interface RegistrationMemberInput {
  name: string;
  email: string;
  phone: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isTrack(value: unknown): value is Track {
  if (typeof value !== 'string') return false;
  if (value === 'AgriTech') return true;
  return TRACKS.includes(value as Track);
}

export const TRACKS = [
  'Cyber-Physical Security & Defense',
  'Smart Mobility & Aerospace',
  'HealthTech & Bio-Wearables',
  'Deep Tech & Edge AI',
  'AgriTech',
  'Open Innovation',
] as const;

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
  return typeof value === 'string' && TRACKS.includes(value as Track);
}

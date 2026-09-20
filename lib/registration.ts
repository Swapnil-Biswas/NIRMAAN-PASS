import { Team, Member, TeamReviewStatus } from '@/types/database';

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

export interface RegistrationTeamInput {
  teamName: string;
  college: string;
  track: Track;
  leader: RegistrationMemberInput;
  members: RegistrationMemberInput[];
}

/**
 * Normalizes email: trims and converts to lowercase
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes Indian and standard international phone numbers into canonical 10-digit format
 * e.g., '+91 98765 43210', '09876543210', '98765-43210' -> '9876543210'
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/[^0-9]/g, '');

  // 12 digits with Indian country code 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }

  // 11 digits with leading 0
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }

  // Standard 10-digit number or other digit lengths
  return digitsOnly;
}

/**
 * Normalizes human names for comparison
 */
export function normalizeName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes college/institution names
 */
export function normalizeCollege(college: string): string {
  return (college || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Canonicalizes team name by removing all whitespace, dashes, underscores, and punctuation
 * e.g. "0x DEADEAD" -> "0xdeadead", "Byte-Crafters!" -> "bytecrafters"
 */
export function canonicalizeTeamName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isTrack(value: unknown): value is Track {
  if (typeof value !== 'string') return false;
  if (value === 'AgriTech') return true;
  return TRACKS.includes(value as Track);
}

/**
 * Levenshtein distance similarity algorithm (0.0 = completely different, 1.0 = identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = canonicalizeTeamName(str1);
  const s2 = canonicalizeTeamName(str2);

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  return 1 - distance / maxLength;
}

export interface DuplicateCheckResult {
  action: 'allow' | 'flag_duplicate' | 'hard_block';
  reviewStatus: TeamReviewStatus;
  matchedTeam?: Team & { members?: Member[] };
  reason?: string;
  matchedFields?: string[];
}

export type ExistingTeamWithMembers = Team & { members: Member[] };

/**
 * Multi-factor anti-duplicate detection engine
 */
export function detectTeamDuplicates(
  input: RegistrationTeamInput,
  existingTeams: ExistingTeamWithMembers[]
): DuplicateCheckResult {
  const newCanonicalName = canonicalizeTeamName(input.teamName);
  const newNormalizedCollege = normalizeCollege(input.college);

  const allNewMembers = [input.leader, ...input.members];
  const newEmails = allNewMembers.map((m) => normalizeEmail(m.email)).filter(Boolean);
  const newPhones = allNewMembers.map((m) => normalizePhone(m.phone)).filter(Boolean);
  const newNames = allNewMembers.map((m) => normalizeName(m.name)).filter(Boolean);

  for (const existingTeam of existingTeams) {
    // Ignore rejected or merged duplicate teams during duplicate comparison
    if (existingTeam.review_status === 'rejected' || existingTeam.review_status === 'merged') {
      continue;
    }

    const existingMembers = existingTeam.members || [];
    const existingEmails = existingMembers.map((m) => normalizeEmail(m.email)).filter(Boolean);
    const existingPhones = existingMembers
      .map((m) => m.normalized_phone || normalizePhone(m.phone))
      .filter(Boolean);
    const existingNames = existingMembers.map((m) => normalizeName(m.name)).filter(Boolean);
    const existingCanonicalName = existingTeam.canonical_name || canonicalizeTeamName(existingTeam.team_name);
    const existingNormalizedCollege = normalizeCollege(existingTeam.college);

    // 1. HARD BLOCK: Exact Email Collision
    const matchingEmail = newEmails.find((e) => existingEmails.includes(e));
    if (matchingEmail) {
      return {
        action: 'hard_block',
        reviewStatus: 'rejected',
        matchedTeam: existingTeam,
        reason: `Participant email is already registered in team '${existingTeam.team_name}'. Each participant can belong to only one team.`,
        matchedFields: ['email'],
      };
    }

    // 2. HARD BLOCK: Exact Phone Number Collision
    const matchingPhone = newPhones.find((p) => existingPhones.includes(p));
    if (matchingPhone) {
      return {
        action: 'hard_block',
        reviewStatus: 'rejected',
        matchedTeam: existingTeam,
        reason: `Participant contact number is already registered in team '${existingTeam.team_name}'. Each participant can belong to only one team.`,
        matchedFields: ['phone'],
      };
    }

    // 3. HARD BLOCK: Exact Canonical Team Name + Same College
    if (newCanonicalName === existingCanonicalName && newNormalizedCollege === existingNormalizedCollege) {
      return {
        action: 'hard_block',
        reviewStatus: 'rejected',
        matchedTeam: existingTeam,
        reason: `A team with the name '${existingTeam.team_name}' is already registered from ${existingTeam.college}. If this is your team, please sign in.`,
        matchedFields: ['team_name', 'college'],
      };
    }

    // 4. SUSPICIOUS / FLAGGED DUPLICATE CHECKS:

    // Case A: 2 or more member names overlap from the same college
    const matchingNameCount = newNames.filter((n) => existingNames.includes(n)).length;
    if (matchingNameCount >= 2 && newNormalizedCollege === existingNormalizedCollege) {
      return {
        action: 'flag_duplicate',
        reviewStatus: 'flagged_duplicate',
        matchedTeam: existingTeam,
        reason: `${matchingNameCount} participant names match existing registered team '${existingTeam.team_name}' from the same institution.`,
        matchedFields: ['member_names', 'college'],
      };
    }

    // Case B: High Team Name Similarity (>= 82%) + Same College
    const similarity = calculateSimilarity(input.teamName, existingTeam.team_name);
    if (similarity >= 0.82 && newNormalizedCollege === existingNormalizedCollege) {
      return {
        action: 'flag_duplicate',
        reviewStatus: 'flagged_duplicate',
        matchedTeam: existingTeam,
        reason: `Team name is ${Math.round(similarity * 100)}% similar to '${existingTeam.team_name}' from the same college.`,
        matchedFields: ['team_name_similarity', 'college'],
      };
    }

    // Case C: Exact Canonical Team Name from a different college (Generic name collision)
    if (newCanonicalName === existingCanonicalName && newNormalizedCollege !== existingNormalizedCollege) {
      return {
        action: 'flag_duplicate',
        reviewStatus: 'flagged_duplicate',
        matchedTeam: existingTeam,
        reason: `Team name '${existingTeam.team_name}' is already used by another institution (${existingTeam.college}). Flagged for organizer review.`,
        matchedFields: ['generic_team_name'],
      };
    }
  }

  // 5. Clean, unique registration
  return {
    action: 'allow',
    reviewStatus: 'approved',
  };
}

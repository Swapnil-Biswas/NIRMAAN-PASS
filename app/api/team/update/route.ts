import { NextRequest, NextResponse } from 'next/server';
import { updateTeamDetails, getAllTeams, findTeamById } from '@/lib/data/store';
import {
  isTrack,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  detectTeamDuplicates,
  type RegistrationMemberInput,
} from '@/lib/registration';
import {
  verifyTeamSessionToken,
  createTeamSessionToken,
  TEAM_COOKIE_NAME,
  MAX_TEAM_SESSION_LIFETIME_MS,
} from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`team_update:${ip}`, 20, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many update requests. Please slow down.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { teamId, token, teamName, college, track, leader, members } = body;

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Valid teamId is required' },
        { status: 400 }
      );
    }

    // Verify authentication: Strict Session or Admin verification
    let authorized = false;
    const sessionCookie = req.cookies.get(TEAM_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const verified = verifyTeamSessionToken(sessionCookie);
      // Strictly verify that authenticated session matches the target teamId
      if (verified && verified.teamId === teamId) {
        authorized = true;
      }
    }

    // Check admin session header/cookie if admin is editing
    if (!authorized) {
      const { verifyAdminSession } = await import('@/lib/auth/admin');
      if (verifyAdminSession(req)) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please sign in to edit your team details.' },
        { status: 401 }
      );
    }

    const trimmedTeamName = typeof teamName === 'string' ? teamName.trim() : '';
    const trimmedCollege = typeof college === 'string' ? college.trim() : '';
    const rawLeader = leader as RegistrationMemberInput | undefined;
    const rawMembers = Array.isArray(members) ? members : [];

    if (!trimmedTeamName || !trimmedCollege || !rawLeader?.name || !rawLeader.email || !rawLeader.phone) {
      return NextResponse.json(
        { success: false, message: 'Team name, college, and leader details are required.' },
        { status: 400 }
      );
    }

    const effectiveTrack = isTrack(track) ? track : 'Open Innovation';

    const normalizedLeader = {
      name: rawLeader.name.trim(),
      email: normalizeEmail(rawLeader.email),
      phone: rawLeader.phone.trim(),
    };

    const normalizedMembers = rawMembers
      .filter((m: any) => m?.name && m?.phone)
      .map((m: any) => ({
        name: m.name.trim(),
        email: m.email ? normalizeEmail(m.email) : '',
        phone: m.phone.trim(),
      }));

    if (normalizedMembers.length > 3) {
      return NextResponse.json(
        { success: false, message: 'A team can have a maximum of 4 members including the team leader (Leader + up to 3 members).' },
        { status: 400 }
      );
    }

    // Validate email format and domain extension for leader
    if (!isValidEmail(normalizedLeader.email)) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid team leader email with a domain extension (e.g. name@gmail.com, name@hotmail.com, name@college.edu).' },
        { status: 400 }
      );
    }

    // Validate phone number format (not more than 10 digits) for leader
    if (!isValidPhone(normalizedLeader.phone)) {
      return NextResponse.json(
        { success: false, message: 'Team leader contact phone must be a valid 10-digit number.' },
        { status: 400 }
      );
    }

    // Validate member phones (and email only if explicitly provided)
    for (let i = 0; i < normalizedMembers.length; i++) {
      const m = normalizedMembers[i];
      if (m.email && !isValidEmail(m.email)) {
        return NextResponse.json(
          { success: false, message: `Please provide a valid email with domain extension for Team Member ${i + 2} (${m.name || 'Member'}).` },
          { status: 400 }
        );
      }
      if (!isValidPhone(m.phone)) {
        return NextResponse.json(
          { success: false, message: `Contact phone for Team Member ${i + 2} (${m.name || 'Member'}) must be a valid 10-digit number.` },
          { status: 400 }
        );
      }
    }

    // Internal duplicate email check for non-empty emails
    const emails = [normalizedLeader.email, ...normalizedMembers.map((m: any) => m.email)].filter(Boolean);
    if (new Set(emails).size !== emails.length) {
      return NextResponse.json(
        { success: false, message: 'Each team member must have a unique email address.' },
        { status: 400 }
      );
    }

    // Internal duplicate phone check
    const phones = [
      normalizePhone(normalizedLeader.phone),
      ...normalizedMembers.map((m: any) => normalizePhone(m.phone)),
    ];
    if (new Set(phones).size !== phones.length) {
      return NextResponse.json(
        { success: false, message: 'Each team member must have a unique contact phone number.' },
        { status: 400 }
      );
    }

    // Anti-duplicate validation against OTHER registered teams
    const allTeams = await getAllTeams();
    const otherTeams = allTeams.filter((t) => t.id !== teamId);

    const duplicateCheck = detectTeamDuplicates(
      {
        teamName: trimmedTeamName,
        college: trimmedCollege,
        track,
        leader: normalizedLeader,
        members: normalizedMembers,
      },
      otherTeams
    );

    if (duplicateCheck.action === 'hard_block') {
      return NextResponse.json(
        {
          success: false,
          error_code: 'DUPLICATE_REGISTRATION',
          message: duplicateCheck.reason || 'Collides with another registered team or participant.',
        },
        { status: 409 }
      );
    }

    const result = await updateTeamDetails(teamId, {
      teamName: trimmedTeamName,
      college: trimmedCollege,
      track: effectiveTrack,
      leader: normalizedLeader,
      members: normalizedMembers,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Team details updated successfully.',
      team: result.team,
      members: result.members,
    });

    // Update signed session cookie with updated name/email
    if (result.team) {
      const signedToken = createTeamSessionToken({
        teamId: result.team.id,
        email: normalizedLeader.email,
        token: result.team.qr_token,
        team_name: result.team.team_name,
      });

      response.cookies.set({
        name: TEAM_COOKIE_NAME,
        value: signedToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(MAX_TEAM_SESSION_LIFETIME_MS / 1000),
      });
    }

    return response;
  } catch (error: any) {
    console.error('Error in team update route:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error updating team details.' },
      { status: 500 }
    );
  }
}

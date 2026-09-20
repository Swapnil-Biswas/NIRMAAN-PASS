import { NextRequest, NextResponse } from 'next/server';
import { updateTeamDetails, getAllTeams, findTeamById, findTeamByToken } from '@/lib/data/store';
import {
  isTrack,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  detectTeamDuplicates,
  type RegistrationMemberInput,
} from '@/lib/registration';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamId, token, teamName, college, track, leader, members } = body;

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: 'teamId is required' },
        { status: 400 }
      );
    }

    // Verify team authentication either via session cookie or matching qr_token
    let authorized = false;
    const sessionCookie = req.cookies.get('nirmaan_team_session')?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie);
        if (parsed.teamId === teamId || parsed.token === token) {
          authorized = true;
        }
      } catch {}
    }

    if (!authorized && token) {
      const teamByToken = await findTeamByToken(token);
      if (teamByToken && teamByToken.id === teamId) {
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

    if (!trimmedTeamName || !trimmedCollege || !isTrack(track) || !rawLeader?.name || !rawLeader.email || !rawLeader.phone) {
      return NextResponse.json(
        { success: false, message: 'Team name, college, valid track, and leader details are required.' },
        { status: 400 }
      );
    }

    const normalizedLeader = {
      name: rawLeader.name.trim(),
      email: normalizeEmail(rawLeader.email),
      phone: rawLeader.phone.trim(),
    };

    const normalizedMembers = rawMembers
      .filter((m: RegistrationMemberInput) => m?.name && m?.email && m?.phone)
      .map((m: RegistrationMemberInput) => ({
        name: m.name.trim(),
        email: normalizeEmail(m.email),
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

    // Validate member emails and phones
    for (let i = 0; i < normalizedMembers.length; i++) {
      const m = normalizedMembers[i];
      if (!isValidEmail(m.email)) {
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

    // Internal duplicate email check
    const emails = [normalizedLeader.email, ...normalizedMembers.map((m: RegistrationMemberInput) => m.email)];
    if (new Set(emails).size !== emails.length) {
      return NextResponse.json(
        { success: false, message: 'Each team member must have a unique email address.' },
        { status: 400 }
      );
    }

    // Internal duplicate phone check
    const phones = [
      normalizePhone(normalizedLeader.phone),
      ...normalizedMembers.map((m: RegistrationMemberInput) => normalizePhone(m.phone)),
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
      track,
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

    // Update session cookie with updated name/email
    if (result.team) {
      response.cookies.set({
        name: 'nirmaan_team_session',
        value: JSON.stringify({
          teamId: result.team.id,
          email: normalizedLeader.email,
          token: result.team.qr_token,
          team_name: result.team.team_name,
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
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

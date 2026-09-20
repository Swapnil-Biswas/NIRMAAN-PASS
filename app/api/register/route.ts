import { NextRequest, NextResponse } from 'next/server';
import { createTeam, getAllTeams } from '@/lib/data/store';
import {
  isTrack,
  normalizeEmail,
  normalizePhone,
  detectTeamDuplicates,
  type RegistrationMemberInput,
} from '@/lib/registration';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    const college = typeof body.college === 'string' ? body.college.trim() : '';
    const track = body.track;
    const leader = body.leader as RegistrationMemberInput | undefined;
    const members = Array.isArray(body.members) ? body.members : [];

    if (!teamName || !college || !isTrack(track) || !leader?.name || !leader.email || !leader.phone) {
      return NextResponse.json(
        { success: false, message: 'Team, college, track, and complete leader details are required.' },
        { status: 400 }
      );
    }

    const normalizedLeader = {
      name: leader.name.trim(),
      email: normalizeEmail(leader.email),
      phone: leader.phone.trim(),
    };
    const normalizedMembers = members
      .filter((member: RegistrationMemberInput) => member?.name && member?.email && member?.phone)
      .map((member: RegistrationMemberInput) => ({
        name: member.name.trim(),
        email: normalizeEmail(member.email),
        phone: member.phone.trim(),
      }));

    if (normalizedMembers.length > 3) {
      return NextResponse.json(
        { success: false, message: 'A team can have a maximum of 4 members including the team leader (Leader + up to 3 members).' },
        { status: 400 }
      );
    }

    // Internal duplicate email check
    const emails = [normalizedLeader.email, ...normalizedMembers.map((m: RegistrationMemberInput) => m.email)];
    if (new Set(emails).size !== emails.length) {
      return NextResponse.json(
        { success: false, message: 'Each team member must use a unique email address.' },
        { status: 400 }
      );
    }

    // Internal duplicate phone check
    const normalizedPhones = [
      normalizePhone(normalizedLeader.phone),
      ...normalizedMembers.map((m: RegistrationMemberInput) => normalizePhone(m.phone)),
    ];
    if (new Set(normalizedPhones).size !== normalizedPhones.length) {
      return NextResponse.json(
        { success: false, message: 'Each team member must use a unique contact phone number.' },
        { status: 400 }
      );
    }

    const registrationInput = {
      teamName,
      college,
      track,
      leader: normalizedLeader,
      members: normalizedMembers,
    };

    // Retrieve existing teams and run anti-duplicate detection
    const existingTeams = await getAllTeams();
    const duplicateCheck = detectTeamDuplicates(registrationInput, existingTeams);

    if (duplicateCheck.action === 'hard_block') {
      return NextResponse.json(
        {
          success: false,
          error_code: 'DUPLICATE_REGISTRATION',
          message: duplicateCheck.reason || 'This team or participant is already registered for NIRMAAN 2026.',
        },
        { status: 409 }
      );
    }

    const team = await createTeam({
      teamName,
      college,
      track,
      leader: normalizedLeader,
      members: normalizedMembers,
      reviewStatus: duplicateCheck.reviewStatus,
      duplicateNotes: duplicateCheck.reason,
      duplicateMatchTeamId: duplicateCheck.matchedTeam?.id,
    });

    const response = NextResponse.json({
      success: true,
      team_name: team.team_name,
      review_status: team.review_status,
      message: 'Registration complete. Your team pass is ready.',
    });

    response.cookies.set({
      name: 'nirmaan_team_session',
      value: JSON.stringify({
        teamId: team.id,
        email: normalizedLeader.email,
        token: team.qr_token,
        team_name: team.team_name,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to complete registration. Please try again.' },
      { status: 500 }
    );
  }
}

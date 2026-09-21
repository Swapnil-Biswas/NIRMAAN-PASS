import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { verifyTeamSessionToken, TEAM_COOKIE_NAME } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let localSession = req.cookies.get(TEAM_COOKIE_NAME)?.value;
    if (!localSession) {
      try {
        const cookieStore = await cookies();
        localSession = cookieStore.get(TEAM_COOKIE_NAME)?.value;
      } catch {}
    }

    // 1. Check verified local team session cookie
    if (localSession) {
      const parsed = verifyTeamSessionToken(localSession);
      if (parsed) {
        return NextResponse.json({
          loggedIn: true,
          email: parsed.email,
          teamId: parsed.teamId,
          token: parsed.token,
          team_name: parsed.team_name,
        });
      }
    }

    // 2. Check Supabase session if configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !url.includes('placeholder')) {
      try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return NextResponse.json({
            loggedIn: true,
            email: user.email,
            userId: user.id,
          });
        }
      } catch {}
    }

    return NextResponse.json({ loggedIn: false });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}

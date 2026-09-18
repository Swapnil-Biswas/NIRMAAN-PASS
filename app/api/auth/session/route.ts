import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let localSession = req.cookies.get('nirmaan_team_session')?.value;
    if (!localSession) {
      try {
        const cookieStore = await cookies();
        localSession = cookieStore.get('nirmaan_team_session')?.value;
      } catch {}
    }

    // 1. Check local team session cookie
    if (localSession) {
      try {
        let raw = localSession;
        try {
          raw = decodeURIComponent(localSession);
        } catch {}
        const parsed = JSON.parse(raw);
        return NextResponse.json({
          loggedIn: true,
          email: parsed.email,
          teamId: parsed.teamId,
          token: parsed.token,
        });
      } catch {}
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

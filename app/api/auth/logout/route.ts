import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !url.includes('placeholder')) {
      try {
        const supabase = createClient(cookieStore);
        await supabase.auth.signOut();
      } catch {}
    }
  } catch {}

  const response = NextResponse.json({ success: true, message: 'Signed out successfully.' });
  response.cookies.delete('nirmaan_team_session');

  return response;
}

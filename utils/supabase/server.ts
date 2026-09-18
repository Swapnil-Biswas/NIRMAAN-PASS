import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const FALLBACK_SUPABASE_URL = "https://tgpxcqazpifkifsnfmmz.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_c2UWGV6nf9YMEUOD_VWrbQ_LqtY0EuD";

export const createClient = (cookieStore?: Awaited<ReturnType<typeof cookies>>) => {
  const store = cookieStore || cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_KEY;

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    },
  );
};

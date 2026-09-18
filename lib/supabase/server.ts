import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient(cookieStoreParam?: Awaited<ReturnType<typeof cookies>>) {
  const cookieStore = cookieStoreParam || cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Handled in Server Components
        }
      },
    },
    global: {
      fetch: (url: RequestInfo | URL, init?: RequestInit) => {
        return fetch(url, {
          ...init,
          cache: 'no-store',
        });
      },
    },
  });
}

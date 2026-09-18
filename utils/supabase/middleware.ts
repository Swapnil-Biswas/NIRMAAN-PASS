import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const FALLBACK_SUPABASE_URL = "https://tgpxcqazpifkifsnfmmz.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_c2UWGV6nf9YMEUOD_VWrbQ_LqtY0EuD";

function isValidHttpUrl(urlString?: string): boolean {
  if (!urlString) return false;
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_KEY;

  // If Supabase URL or Key is missing, invalid, or placeholder, pass through cleanly
  if (
    !supabaseUrl ||
    !supabaseKey ||
    !isValidHttpUrl(supabaseUrl) ||
    supabaseUrl.includes("placeholder")
  ) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          try {
            return request.cookies.getAll();
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          } catch (cookieError) {
            console.error("[Middleware] Cookie manipulation error:", cookieError);
          }
        },
      },
    });

    // Refresh user session if present
    await supabase.auth.getUser();
  } catch (error) {
    console.error("[Middleware] Session refresh error caught safely:", error);
    return supabaseResponse;
  }

  return supabaseResponse;
};

export const createClient = updateSession;

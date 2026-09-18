import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Routing Middleware
 * Clean pass-through ensuring zero edge runtime failures.
 * Participant and Admin authentication are securely handled by
 * server layout gates (AdminGate) and Route Handlers.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images / static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

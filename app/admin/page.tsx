import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Root /admin page
 * When authenticated, redirects directly to the QR scanner (primary ops tool).
 * When unauthenticated, intercepted by app/admin/layout.tsx (AdminGate challenge).
 */
export default function AdminRootPage() {
  redirect('/admin/scanner');
}

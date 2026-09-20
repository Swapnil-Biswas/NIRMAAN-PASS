import React from 'react';
import { verifyAdminSession } from '@/lib/auth/admin';
import AdminGate from '@/components/Admin/AdminGate';
import AdminNavbar from '@/components/Admin/AdminNavbar';
import AdminSessionGuard from '@/components/Admin/AdminSessionGuard';

export const dynamic = 'force-dynamic';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthorized = verifyAdminSession();

  if (!isAuthorized) {
    return <AdminGate />;
  }

  return (
    <AdminSessionGuard>
      <div className="min-h-screen bg-nirmaan-cream flex flex-col">
        <AdminNavbar />
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </AdminSessionGuard>
  );
}

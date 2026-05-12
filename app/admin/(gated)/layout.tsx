import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/features/admin/components/AdminNav';
import { requireAdmin, AdminAuthError } from '@/features/admin/lib/requireAdmin';

// Auth gating MUST run on every request — bypassing the cache is the whole
// point. Without `force-dynamic` the gated subtree could serve a stale shell
// to an unauth visitor before the redirect fires.
export const dynamic = 'force-dynamic';

export default async function GatedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let principal;
  try {
    principal = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAuthError) redirect('/admin/login');
    throw err;
  }

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      <AdminNav adminEmail={principal.email} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

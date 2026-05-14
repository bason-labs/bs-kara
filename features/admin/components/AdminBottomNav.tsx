'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_ITEMS } from '../lib/navItems';
import { adminSignOut } from '../lib/adminClient';

export function AdminBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await adminSignOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden flex border-t border-border bg-surface/70 backdrop-blur-md"
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'flex-1 flex flex-col items-center py-3 text-xs transition-colors ' +
              (active ? 'text-fg font-medium' : 'text-muted hover:text-fg')
            }
          >
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex-1 flex flex-col items-center py-3 text-xs text-muted hover:text-fg transition-colors"
      >
        Đăng xuất
      </button>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
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
      className="fixed bottom-0 inset-x-0 z-40 md:hidden flex border-t border-border bg-surface/95 backdrop-blur-md"
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 transition-colors"
          >
            <span
              className={
                'flex items-center justify-center rounded-lg w-9 h-7 transition-colors ' +
                (active
                  ? 'bg-[rgba(0,139,139,0.2)] border border-[rgba(0,139,139,0.4)]'
                  : '')
              }
            >
              <Icon
                size={16}
                aria-hidden
                className={active ? 'text-accent' : 'text-muted'}
              />
            </span>
            <span
              className={
                'text-[9px] transition-colors ' +
                (active ? 'text-accent font-semibold' : 'text-muted')
              }
            >
              {item.label}
            </span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex-1 flex flex-col items-center py-2.5 gap-1 text-muted hover:text-accent transition-colors"
        aria-label="Đăng xuất"
      >
        <span className="flex items-center justify-center w-9 h-7">
          <LogOut size={16} aria-hidden />
        </span>
        <span className="text-[9px]">Thoát</span>
      </button>
    </nav>
  );
}

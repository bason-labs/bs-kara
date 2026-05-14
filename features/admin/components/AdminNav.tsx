'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminSignOut } from '../lib/adminClient';

interface NavItem {
  href: string;
  label: string;
}

// Config-driven nav. Future phases append entries here for the 9 follow-on
// admin features (room stats, IP/device sessions, search counts, queue ops,
// firebase/youtube quotas, whitelist, free-trial list, dashboard KPIs) — see
// design report §3.10. No structural refactor required to add a sibling
// route.
const NAV_ITEMS: NavItem[] = [
  { href: '/admin/subscriptions', label: 'Gói đăng ký' },
  { href: '/admin/stats', label: 'Thống kê' },
  { href: '/admin/sessions', label: 'Phiên' },
  // Future:
  // { href: '/admin/rooms',           label: 'Phòng' },
  // { href: '/admin/devices',         label: 'Thiết bị' },
  // { href: '/admin/search',          label: 'Tìm kiếm' },
  // { href: '/admin/queue-ops',       label: 'Hàng chờ' },
  // { href: '/admin/quota/firebase',  label: 'Quota Firebase' },
  // { href: '/admin/quota/youtube',   label: 'Quota YouTube' },
  // { href: '/admin/whitelist',       label: 'Whitelist' },
  // { href: '/admin/trials',          label: 'Dùng thử' },
];

export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await adminSignOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface/70 backdrop-blur-md flex flex-col">
      <div className="px-5 py-6 border-b border-border">
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Quản trị</p>
        <p className="mt-1 text-sm text-fg truncate" title={adminEmail}>
          {adminEmail}
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'block px-3 py-2 rounded-lg text-sm transition-colors ' +
                (active
                  ? 'bg-bg/60 text-fg font-medium'
                  : 'text-muted hover:bg-bg/40 hover:text-fg')
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-2 rounded-full border border-border bg-bg/40 text-sm text-fg hover:bg-bg/60 transition-colors"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

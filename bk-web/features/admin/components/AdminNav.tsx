'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { adminSignOut } from '../lib/adminClient';
import { NAV_ITEMS } from '../lib/navItems';

export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await adminSignOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface/70 backdrop-blur-md flex-col h-full overflow-y-auto hidden md:flex">
      {/* Logo row */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-[9px] bg-gradient-brand flex-shrink-0 shadow-glow flex items-center justify-center">
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden>
            <path
              d="M5 1v9M5 1h7v5H5M5 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"
              stroke="#e0ffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-fg leading-none">BS Kara</p>
          <p className="text-[10px] text-muted mt-0.5">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <div className="px-3 flex-1">
        <p className="px-2 mb-2 text-[9px] uppercase tracking-[0.2em] text-muted/50">Menu</p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors border ' +
                  (active
                    ? 'bg-[rgba(0,139,139,0.15)] border-[rgba(0,139,139,0.4)] shadow-[0_0_18px_-6px_rgba(125,249,255,0.28)]'
                    : 'border-transparent text-muted hover:bg-[rgba(0,139,139,0.08)] hover:text-accent')
                }
                style={active ? { color: '#7df9ff' } : undefined}
              >
                <Icon size={15} aria-hidden />
                <span className={active ? 'font-semibold' : ''}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[rgba(0,139,139,0.2)] border border-[rgba(0,139,139,0.4)] flex-shrink-0 flex items-center justify-center">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#40e0d0"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted truncate" title={adminEmail}>
              {adminEmail}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1 text-[10px] text-muted/50 hover:text-accent transition-colors mt-0.5"
            >
              <LogOut size={10} aria-hidden />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

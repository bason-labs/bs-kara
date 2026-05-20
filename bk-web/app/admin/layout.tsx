import type { ReactNode } from 'react';

// Top-level admin shell: intentionally NO gate here. The gate lives in
// `app/admin/(gated)/layout.tsx` so it can wrap every authed route while the
// public `/admin/login` page (a sibling of (gated)) stays reachable. URL
// paths are unaffected — (gated) is a route group, not a URL segment.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div data-theme="dark" className="min-h-screen bg-bg text-fg">{children}</div>;
}

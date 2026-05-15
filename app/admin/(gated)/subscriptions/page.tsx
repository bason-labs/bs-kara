import Link from 'next/link';
import { SubscriptionsTableContainer } from '@/features/admin/components/SubscriptionsTableContainer';

export default function SubscriptionsPage() {
  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-fg">Gói đăng ký</h1>
          <p className="mt-1 text-xs text-muted">
            Danh sách gói đăng ký dùng thử và trả phí.
          </p>
        </div>
        <Link
          href="/admin/subscriptions/new"
          className="bg-gradient-brand rounded-lg px-4 py-2 text-sm font-semibold text-fg shadow-glow whitespace-nowrap"
        >
          + Thêm mới
        </Link>
      </div>
      <SubscriptionsTableContainer />
    </div>
  );
}

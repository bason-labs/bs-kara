import { SubscriptionsTableContainer } from '@/features/admin/components/SubscriptionsTableContainer';

export default function SubscriptionsPage() {
  return (
    <div className="px-6 py-8 space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-wide">Gói đăng ký</h1>
        <p className="mt-1 text-xs text-muted">
          Danh sách gói đăng ký dùng thử và trả phí.
        </p>
      </header>
      <SubscriptionsTableContainer />
    </div>
  );
}

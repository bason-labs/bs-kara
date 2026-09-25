import { SubscriptionForm } from '@/features/admin/components/SubscriptionForm';

export default function NewSubscriptionPage() {
  return (
    <div className="px-6 py-8 space-y-6">
      <header>
        <h1 className="text-lg font-bold text-fg">
          Thêm gói đăng ký mới
        </h1>
        <p className="mt-1 text-xs text-muted">
          Tạo gói dùng thử hoặc trả phí cho một số điện thoại.
        </p>
      </header>
      <SubscriptionForm />
    </div>
  );
}

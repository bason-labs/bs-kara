import type { DerivedStatus, SubscriptionRecord } from '@/lib/subscriptions/schema';

// Display labels shared by the subscriptions table and detail page.
export const TYPE_LABEL: Record<SubscriptionRecord['type'], string> = {
  trial: 'Dùng thử',
  paid: 'Trả phí',
};

export const SOURCE_LABEL: Record<SubscriptionRecord['source'], string> = {
  manual_admin: 'Thủ công',
  self_register_phone: 'Tự đăng ký',
  payment_webhook: 'Thanh toán',
};

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  active: 'Đang hoạt động',
  scheduled: 'Chưa bắt đầu',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
};

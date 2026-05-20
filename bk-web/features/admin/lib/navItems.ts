import type { LucideIcon } from 'lucide-react';
import { CreditCard, BarChart2 } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin/subscriptions', label: 'Đăng ký', icon: CreditCard },
  { href: '/admin/stats',         label: 'Thống kê', icon: BarChart2  },
];

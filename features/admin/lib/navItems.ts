import type { LucideIcon } from 'lucide-react';
import { CreditCard, BarChart2, Monitor, Users } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin/subscriptions', label: 'Đăng ký', icon: CreditCard },
  { href: '/admin/stats',         label: 'Thống kê', icon: BarChart2  },
  { href: '/admin/sessions',      label: 'Phiên',    icon: Monitor    },
  { href: '/admin/rooms',         label: 'Phòng',    icon: Users      },
];

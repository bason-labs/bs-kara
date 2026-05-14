export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin/subscriptions', label: 'Gói đăng ký' },
  { href: '/admin/stats', label: 'Thống kê' },
  { href: '/admin/sessions', label: 'Phiên' },
];

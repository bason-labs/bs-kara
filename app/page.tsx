import type { Metadata } from 'next';
import RemoteClient from '@/features/remote/RemoteClient';

export const metadata: Metadata = {
  title: 'Điều khiển & Chọn bài | BS Kara',
};

export default function Page() {
  return <RemoteClient />;
}

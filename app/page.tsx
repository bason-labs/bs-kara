import type { Metadata } from 'next';
import RemoteClient from './RemoteClient';

export const metadata: Metadata = {
  title: 'Điều khiển & Chọn bài',
};

export default function Page() {
  return <RemoteClient />;
}

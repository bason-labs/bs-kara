import type { Metadata } from 'next';
import TVClient from './TVClient';

export const metadata: Metadata = {
  title: 'Màn hình hiển thị TV',
};

export default function Page() {
  return <TVClient />;
}

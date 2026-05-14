import { SubscriptionDetail } from '@/features/admin/components/SubscriptionDetail';

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-6 py-8">
      <SubscriptionDetail id={id} />
    </div>
  );
}

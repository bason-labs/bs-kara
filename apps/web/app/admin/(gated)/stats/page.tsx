import { WhitelistPanel } from '@/features/admin/components/WhitelistPanel';
import { StatsShell } from '@/features/admin/components/StatsShell';

export default function StatsPage() {
  return (
    <div className="px-6 py-8 space-y-8">
      <header>
        <h1 className="text-lg font-bold text-fg">Thống kê</h1>
        <p className="mt-1 text-xs text-muted">
          Tổng quan phòng, quota API và danh sách whitelist.
        </p>
      </header>
      <WhitelistPanel />
      <StatsShell />
    </div>
  );
}

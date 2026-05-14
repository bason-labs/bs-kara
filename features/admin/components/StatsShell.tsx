'use client';

import { useAdminData } from '../context/AdminDataContext';
import { StatCard } from './StatCard';
import { RoomsTable } from './RoomsTable';
import { QuotaChart } from './QuotaChart';
import { SearchStatsChart } from './SearchStatsChart';
import { QueueOpsTable } from './QueueOpsTable';

export function StatsShell() {
  const { stats, quota, searchStats, queueOps } = useAdminData();

  if (stats.loading) {
    return (
      <div className="space-y-3 animate-pulse" role="status" aria-label="Đang tải…">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-5 bg-border/60 rounded"
            style={{ width: `${55 + i * 10}%` }}
          />
        ))}
      </div>
    );
  }

  if (stats.error) {
    return (
      <p className="text-sm text-danger" role="alert">
        Lỗi tải thống kê: {stats.error}
      </p>
    );
  }

  const s = stats.data!;

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <section aria-label="Chỉ số tổng quan" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Tổng số phòng" value={s.totalRooms} />
        <StatCard label="Phòng có TV" value={s.activeTvRooms} variant="accent" />
        <StatCard
          label="Tổng hàng chờ"
          value={s.totalQueueDepth}
          sublabel="Số bài trong tất cả phòng"
        />
      </section>

      {/* Rooms table */}
      <section aria-label="Danh sách phòng" className="space-y-3">
        <h2 className="text-sm font-medium text-fg">Phòng đang hoạt động</h2>
        <RoomsTable rooms={s.rooms} />
      </section>

      {/* YouTube quota chart */}
      <section aria-label="Quota YouTube" className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-fg">Quota YouTube API</h2>
          <p className="text-[11px] text-muted mt-0.5">30 ngày gần nhất · múi giờ PT</p>
        </div>
        {quota.loading && <p className="text-xs text-muted">Đang tải…</p>}
        {quota.error && <p className="text-xs text-danger">Lỗi: {quota.error}</p>}
        {quota.data && (
          <QuotaChart days={quota.data.days} dailyLimitCalls={quota.data.dailyLimitCalls} />
        )}
      </section>

      {/* Search statistics */}
      <section aria-label="Thống kê tìm kiếm" className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-fg">Tìm kiếm YouTube</h2>
          <p className="text-[11px] text-muted mt-0.5">30 ngày gần nhất · múi giờ PT</p>
        </div>
        {searchStats.loading && <p className="text-xs text-muted">Đang tải…</p>}
        {searchStats.error && <p className="text-xs text-danger">Lỗi: {searchStats.error}</p>}
        {searchStats.data && <SearchStatsChart days={searchStats.data.days} />}
      </section>

      {/* Queue operations */}
      <section aria-label="Thao tác hàng chờ" className="space-y-3">
        <h2 className="text-sm font-medium text-fg">Hàng chờ theo phòng</h2>
        {queueOps.loading && <p className="text-xs text-muted">Đang tải…</p>}
        {queueOps.error && <p className="text-xs text-danger">Lỗi: {queueOps.error}</p>}
        {queueOps.data && <QueueOpsTable rooms={queueOps.data.rooms} />}
        {queueOps.data && (
          <p className="text-xs text-muted">
            Tổng: {queueOps.data.totalAdds} thêm · {queueOps.data.totalRemoves} xóa
          </p>
        )}
      </section>
    </div>
  );
}

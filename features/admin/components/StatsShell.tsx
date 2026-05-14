'use client';

import { useEffect, useState } from 'react';
import { useStatsSnapshot } from '../hooks/useStatsSnapshot';
import { useYoutubeQuota } from '../hooks/useYoutubeQuota';
import { StatCard } from './StatCard';
import { RoomsTable } from './RoomsTable';
import { QuotaChart } from './QuotaChart';

export function StatsShell() {
  const stats = useStatsSnapshot();
  const quota = useYoutubeQuota();

  // SSR hydration guard — avoid baking server-side timestamp into markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag for hydration guard
    setMounted(true);
  }, []);

  if (!mounted || stats.loading) {
    return (
      <p className="text-sm text-muted" role="status">
        Đang tải…
      </p>
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
        <StatCard label="Phòng có TV" value={s.activeTvRooms} />
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
        {quota.loading && (
          <p className="text-xs text-muted">Đang tải…</p>
        )}
        {quota.error && (
          <p className="text-xs text-danger">Lỗi: {quota.error}</p>
        )}
        {quota.data && (
          <QuotaChart days={quota.data.days} dailyLimitCalls={quota.data.dailyLimitCalls} />
        )}
      </section>
    </div>
  );
}

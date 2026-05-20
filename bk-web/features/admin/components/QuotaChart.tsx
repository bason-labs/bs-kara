import type { QuotaDay } from '@/app/api/admin/quota/youtube/route';

interface QuotaChartProps {
  days: QuotaDay[];
  dailyLimitCalls: number;
}

function barColor(calls: number, limit: number): string {
  const pct = limit > 0 ? calls / limit : 0;
  if (pct >= 0.95) return 'bg-danger/70';
  if (pct >= 0.80) return 'bg-yellow-500/60';
  return 'bg-emerald-500/50';
}

export function QuotaChart({ days, dailyLimitCalls }: QuotaChartProps) {
  const maxCalls = Math.max(dailyLimitCalls, ...days.map((d) => d.calls), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 h-28 w-full">
        {days.map((day) => {
          const heightPct = (day.calls / maxCalls) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end"
              title={`${day.date}: ${day.calls} calls`}
            >
              <div
                className={`rounded-t-sm transition-all ${barColor(day.calls, dailyLimitCalls)}`}
                style={{ height: `${heightPct}%`, minHeight: day.calls > 0 ? '2px' : '0' }}
              />
            </div>
          );
        })}
      </div>
      {/* Show first, middle, and last date labels */}
      <div className="flex justify-between text-[10px] text-muted px-0.5">
        <span>{days[0]?.date ?? ''}</span>
        <span>{days[14]?.date ?? ''}</span>
        <span>{days[29]?.date ?? ''}</span>
      </div>
      <p className="text-xs text-muted">
        Giới hạn: {dailyLimitCalls} lượt/ngày (10,000 units). Múi giờ: PT.
      </p>
    </div>
  );
}

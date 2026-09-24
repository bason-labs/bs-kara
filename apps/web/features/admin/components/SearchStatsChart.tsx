import type { SearchDay } from '@/app/api/admin/search-stats/route';

interface SearchStatsChartProps {
  days: SearchDay[];
}

export function SearchStatsChart({ days }: SearchStatsChartProps) {
  const maxTotal = Math.max(...days.map((d) => d.total), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 h-28 w-full">
        {days.map((day) => {
          const totalPct = (day.total / maxTotal) * 100;
          const livePct = maxTotal > 0 ? (day.live / maxTotal) * 100 : 0;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col justify-end relative"
              title={`${day.date}: ${day.total} total, ${day.live} live, ${day.cached} cached`}
            >
              {/* total bar (background) */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-muted/30"
                style={{ height: `${totalPct}%`, minHeight: day.total > 0 ? '2px' : '0' }}
              />
              {/* live bar (foreground) */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-emerald-500/60"
                style={{ height: `${livePct}%`, minHeight: day.live > 0 ? '2px' : '0' }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted px-0.5">
        <span>{days[0]?.date ?? ''}</span>
        <span>{days[14]?.date ?? ''}</span>
        <span>{days[29]?.date ?? ''}</span>
      </div>
      <div className="flex gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/60" /> Live (API call)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-muted/30" /> Cached
        </span>
      </div>
    </div>
  );
}

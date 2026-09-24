interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  variant?: 'default' | 'accent';
}

export function StatCard({ label, value, sublabel, variant = 'default' }: StatCardProps) {
  const accent = variant === 'accent';
  return (
    <div
      className={
        'rounded-2xl border px-5 py-4 space-y-1 ' +
        (accent
          ? 'bg-[rgba(0,139,139,0.12)] border-[rgba(0,139,139,0.4)] shadow-[0_0_20px_-8px_rgba(125,249,255,0.28)]'
          : 'bg-surface/60 backdrop-blur-md border-border')
      }
    >
      <p
        className={
          'text-xs uppercase tracking-[0.16em] ' +
          (accent ? 'text-accent' : 'text-muted')
        }
      >
        {label}
      </p>
      <p
        className={'text-3xl font-semibold ' + (accent ? '' : 'text-fg')}
        style={accent ? { color: '#7df9ff' } : undefined}
      >
        {value}
      </p>
      {sublabel && (
        <p className={'text-xs ' + (accent ? 'text-accent/60' : 'text-muted')}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

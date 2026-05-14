interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
}

export function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 backdrop-blur-md px-5 py-4 space-y-1">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="text-3xl font-semibold text-fg">{value}</p>
      {sublabel && (
        <p className="text-xs text-muted">{sublabel}</p>
      )}
    </div>
  );
}

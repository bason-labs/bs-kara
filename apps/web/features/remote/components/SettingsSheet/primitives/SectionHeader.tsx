'use client';

import type { Shuffle } from 'lucide-react';

interface SectionHeaderProps {
  id: string;
  Icon: typeof Shuffle;
  title: string;
}

export function SectionHeader({ id, Icon, title }: SectionHeaderProps) {
  return (
    <h3
      id={id}
      className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted mb-2.5 px-1"
    >
      <Icon size={13} strokeWidth={2.4} />
      {title}
    </h3>
  );
}

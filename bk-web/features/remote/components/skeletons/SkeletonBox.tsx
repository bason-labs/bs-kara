import type { CSSProperties } from 'react';

interface SkeletonBoxProps {
  className?: string;
  style?: CSSProperties;
}

export function SkeletonBox({ className = '', style }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

'use client';

import type { RegisterStep } from '../types';

// The register flow has an optional display-name step that only appears for
// brand-new phone numbers. It does not get its own progress dot — the
// indicator tracks the two required steps (phone → otp) only. While on the
// optional name step both dots read as completed.
const INDICATOR_STEPS = ['phone', 'otp'] as const satisfies readonly RegisterStep[];

interface StepDotsProps {
  current: RegisterStep;
}

export function StepDots({ current }: StepDotsProps) {
  const activeIndex =
    current === 'name' ? INDICATOR_STEPS.length : INDICATOR_STEPS.indexOf(current);

  return (
    <div className="flex items-center gap-2" role="list" aria-label="Progress">
      {INDICATOR_STEPS.map((s, i) => (
        <div
          key={s}
          role="listitem"
          data-active={i === activeIndex}
          data-complete={i < activeIndex}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === activeIndex
              ? 'w-8 bg-gradient-brand'
              : i < activeIndex
                ? 'w-2 bg-brand/50'
                : 'w-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

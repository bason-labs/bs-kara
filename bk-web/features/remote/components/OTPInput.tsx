'use client';

import {
  ClipboardEvent,
  KeyboardEvent,
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function OTPInput({
  length = 4,
  value,
  onChange,
  onComplete,
  autoFocus = true,
  ariaLabel,
  disabled = false,
  compact = false,
}: OTPInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (autoFocus && !disabled) inputsRef.current[0]?.focus();
  }, [autoFocus, disabled]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setDigitAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (joined.length === length && onComplete) {
      onComplete(joined);
    }
  }

  function focusIndex(i: number) {
    const clamped = Math.max(0, Math.min(length - 1, i));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
    setActiveIndex(clamped);
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigitAt(i, '');
      return;
    }
    // If user pasted multiple chars into one box, distribute.
    if (raw.length > 1) {
      const incoming = raw.slice(0, length - i);
      const next = digits.slice();
      for (let k = 0; k < incoming.length; k++) next[i + k] = incoming[k];
      const joined = next.join('').slice(0, length);
      onChange(joined);
      focusIndex(i + incoming.length);
      if (joined.length === length && onComplete) {
        onComplete(joined);
      }
      return;
    }
    setDigitAt(i, raw);
    if (i < length - 1) focusIndex(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setDigitAt(i, '');
      } else if (i > 0) {
        setDigitAt(i - 1, '');
        focusIndex(i - 1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex(i + 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onChange('');
      focusIndex(0);
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    const incoming = pasted.slice(0, length - i);
    const next = digits.slice();
    for (let k = 0; k < incoming.length; k++) next[i + k] = incoming[k];
    const joined = next.join('').slice(0, length);
    onChange(joined);
    focusIndex(i + incoming.length);
    if (joined.length === length && onComplete) {
      onComplete(joined);
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {digits.map((digit, i) => {
        const filled = digit !== '';
        const isActive = activeIndex === i;
        return (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            onFocus={() => setActiveIndex(i)}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            className={`tabular text-center font-bold rounded-2xl bg-surface border transition-all
              ${compact
                ? 'w-10 h-12 sm:w-12 sm:h-14 text-xl sm:text-2xl'
                : 'w-14 h-16 sm:w-16 sm:h-20 text-3xl sm:text-4xl'}
              text-fg caret-glow
              ${filled ? 'border-brand text-gradient-brand' : 'border-border'}
              ${isActive ? 'shadow-glow border-glow' : ''}
              focus:outline-none focus:border-glow focus:shadow-glow
              disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        );
      })}
    </div>
  );
}

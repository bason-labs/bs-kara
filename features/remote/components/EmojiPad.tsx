'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REACTIONS, getGifUrl } from '@/lib/reactions';

interface EmojiPadProps {
  onSendEmoji: (emoji: string) => void;
}

export function EmojiPad({ onSendEmoji }: EmojiPadProps) {
  const { t } = useTranslation();
  // Per-emoji monotonic counter. Bumped on each tap; threaded into the inner
  // span's `key` so React remounts that span on every click — guaranteeing
  // the bounce animation restarts from 0% even on rapid same-emoji taps.
  const [ticks, setTicks] = useState<Record<string, number>>({});

  return (
    <div className="flex justify-around items-center gap-1 px-3 py-2">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            setTicks((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }));
            onSendEmoji(emoji);
          }}
          aria-label={t('emoji.sendAriaLabel', { emoji })}
          className="
            flex items-center justify-center w-11 h-11 rounded-full
            cursor-pointer transition-all duration-200
            hover:scale-125 hover:bg-glow/10 hover:drop-shadow-lg
            select-none
          "
        >
          <span
            key={`${emoji}-${ticks[emoji] ?? 0}`}
            data-testid={`emoji-bounce-${emoji}`}
            className="emoji-tap-bounce"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getGifUrl(emoji)}
              alt={emoji}
              width={32}
              height={32}
              draggable={false}
              className="w-8 h-8 object-contain"
            />
          </span>
        </button>
      ))}
    </div>
  );
}

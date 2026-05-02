'use client';

import { useTranslation } from 'react-i18next';
import { REACTIONS, getGifUrl } from '@/lib/reactions';

interface EmojiPadProps {
  onSendEmoji: (emoji: string) => void;
}

export function EmojiPad({ onSendEmoji }: EmojiPadProps) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-around items-center gap-1 px-3 py-2">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSendEmoji(emoji)}
          aria-label={t('emoji.sendAriaLabel', { emoji })}
          className="
            flex items-center justify-center w-11 h-11 rounded-full
            cursor-pointer transition-all duration-200
            hover:scale-125 hover:bg-glow/10 hover:drop-shadow-lg
            active:scale-90
            select-none
          "
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
        </button>
      ))}
    </div>
  );
}

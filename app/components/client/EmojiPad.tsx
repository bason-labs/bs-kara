'use client';

import { REACTIONS, getGifUrl } from '@/lib/reactions';

interface EmojiPadProps {
  onSendEmoji: (emoji: string) => void;
}

export function EmojiPad({ onSendEmoji }: EmojiPadProps) {
  return (
    <div className="flex justify-around items-center px-3 py-2.5 bg-black/80 backdrop-blur-sm border-t border-white/10">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSendEmoji(emoji)}
          aria-label={`Send ${emoji}`}
          className="
            flex items-center justify-center w-12 h-12 rounded-full
            cursor-pointer transition-all duration-200
            hover:scale-150 hover:drop-shadow-lg
            active:scale-75
            select-none
          "
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getGifUrl(emoji)}
            alt={emoji}
            width={36}
            height={36}
            draggable={false}
            className="w-9 h-9 object-contain"
          />
        </button>
      ))}
    </div>
  );
}

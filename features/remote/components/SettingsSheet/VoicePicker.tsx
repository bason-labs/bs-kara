'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAIVoice } from '@/hooks/useAIVoice';

// Spoken inside the settings voice picker so the user hears each candidate
// in context. Hardcoded in Vietnamese on purpose: every voice in the
// picker is vi-VN-* and the sample needs to match the language being
// rendered, regardless of the UI's current locale. Each voice gets its
// own line, written to fit that voice's persona (cute / mature / warm /
// energetic) so the previews don't all sound the same.
const VOICE_PREVIEW_SAMPLES: Record<string, string> = {
  'vi-VN-Neural2-A':
    'Hí hí, em là MC đáng yêu của phòng karaoke, sẵn sàng quẩy cùng bạn nha!',
  'vi-VN-Wavenet-C':
    'Xin chào quý vị, một đêm âm nhạc thật trọn vẹn đang chờ mọi người phía trước.',
  'vi-VN-Neural2-D':
    'Chào bạn, hãy cùng nhau thả lỏng và thưởng thức những giai điệu ấm áp đêm nay.',
  'vi-VN-Wavenet-B':
    'Chào cả nhà, sân khấu nóng lên rồi, lên mic và bung hết sức nào!',
};
const VOICE_PREVIEW_FALLBACK =
  'Xin chào, đây là giọng đọc thử của hệ thống.';

// Keep in sync with the ALLOWED_VOICES whitelist in app/api/tts/route.ts.
export const MC_VOICE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'vi-VN-Neural2-A', labelKey: 'settings.mcVoiceOptions.neural2A' },
  { value: 'vi-VN-Wavenet-C', labelKey: 'settings.mcVoiceOptions.wavenetC' },
  { value: 'vi-VN-Neural2-D', labelKey: 'settings.mcVoiceOptions.neural2D' },
  { value: 'vi-VN-Wavenet-B', labelKey: 'settings.mcVoiceOptions.wavenetB' },
];

interface VoicePickerProps {
  value: string;
  disabled: boolean;
  onChange: (voice: string) => void;
  // SettingsSheet stays mounted across open/close (it just slides off-
  // screen), so an unmount-only cleanup leaves a mid-flight preview audible
  // after the user closes the sheet. The picker watches this and cancels
  // the moment it goes false.
  panelOpen: boolean;
}

// Radio-card list with live audio preview. Each card click writes the new
// voice through the parent's onChange (which Firebase-syncs the room) and
// fires a device-local TTS preview — the preview never goes on the wire,
// so other clients (TV, other phones) don't echo it.
export function VoicePicker({
  value,
  disabled,
  onChange,
  panelOpen,
}: VoicePickerProps) {
  const { t } = useTranslation();
  const { previewVoice, cancel } = useAIVoice();

  // Stop any in-flight preview when the sheet closes or the picker
  // unmounts. Without this, closing the sheet mid-playback leaves audio
  // playing.
  useEffect(() => {
    if (!panelOpen) cancel();
    return () => {
      cancel();
    };
  }, [panelOpen, cancel]);

  function handleSelect(voice: string) {
    onChange(voice);
    const sample = VOICE_PREVIEW_SAMPLES[voice] ?? VOICE_PREVIEW_FALLBACK;
    void previewVoice(voice, sample);
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby="settings-mc-voice-label"
      className="grid grid-cols-2 gap-2"
    >
      {MC_VOICE_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => handleSelect(opt.value)}
            className={`relative flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'border-transparent bg-gradient-brand text-white shadow-glow'
                : 'border-border bg-surface text-fg hover:border-glow/40'
            }`}
          >
            <span className="truncate leading-tight">{t(opt.labelKey)}</span>
            {active && (
              <Check
                size={14}
                strokeWidth={2.4}
                aria-hidden
                className="shrink-0"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

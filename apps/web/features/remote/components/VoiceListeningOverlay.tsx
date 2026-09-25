'use client';

import { useTranslation } from 'react-i18next';
import { Mic, X } from 'lucide-react';

interface VoiceListeningOverlayProps {
  // Live partial transcript; the "listening…" prompt shows until the first words arrive.
  interimTranscript: string;
  onClose: () => void;
}

// Full-screen listening state for voice search: pulsing mic, live transcript, close button.
export function VoiceListeningOverlay({ interimTranscript, onClose }: VoiceListeningOverlayProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(6,16,15,0.88)] backdrop-blur-[10px]">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('search.closeVoiceAriaLabel')}
        className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/20"
      >
        <X size={20} className="text-white" />
      </button>
      <div className="relative w-[168px] h-[168px] flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full border-2 border-glow/60 animate-voice-pulse" />
        <div className="absolute inset-0 rounded-full border-2 border-glow/60 animate-voice-pulse-delayed" />
        <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-brand shadow-glow flex items-center justify-center">
          <Mic size={42} className="text-white" strokeWidth={2} />
        </div>
      </div>
      <div className="flex items-center gap-1 mb-3 min-h-8">
        <span className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white tracking-tight">
          {interimTranscript || t('search.listeningMessage')}
        </span>
        <span className="w-0.5 h-[22px] bg-glow animate-blink" />
      </div>
      <p className="text-[13px] text-white/60">{t('search.voiceListenHint')}</p>
    </div>
  );
}

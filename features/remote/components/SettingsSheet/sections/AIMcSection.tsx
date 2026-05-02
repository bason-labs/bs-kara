'use client';

import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../primitives/SectionHeader';
import { ToggleRow } from '../primitives/ToggleRow';
import { VoicePicker } from '../VoicePicker';

interface AIMcSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  mcVoice: string;
  onMcVoiceChange: (voice: string) => void;
}

export function AIMcSection({
  enabled,
  onToggle,
  mcVoice,
  onMcVoiceChange,
}: AIMcSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-aimc" className="space-y-2">
      <SectionHeader
        id="settings-aimc"
        Icon={Sparkles}
        title={t('settings.sections.aiMc')}
      />
      <ToggleRow
        Icon={Sparkles}
        label={t('settings.aiMcLabel')}
        hint={t('settings.aiMcHint')}
        enabled={enabled}
        onToggle={onToggle}
      />
      {/* Animated reveal mirrors the auto-random sub-section pattern: the
          voice picker only matters when MC is on. */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-border bg-surface-2/40 p-4 mt-2 flex flex-col gap-3">
            <span
              id="settings-mc-voice-label"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
            >
              {t('settings.mcVoiceLabel')}
            </span>
            <VoicePicker
              value={mcVoice}
              disabled={!enabled}
              onChange={onMcVoiceChange}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

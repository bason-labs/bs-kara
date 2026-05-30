'use client';

import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RandomFilters } from '@bs-kara/shared';
import { AutoRandomSection } from './sections/AutoRandomSection';
import { QueueSection } from './sections/QueueSection';
import { AIMcSection } from './sections/AIMcSection';
import { ThemeSection } from './sections/ThemeSection';
import { RoomSection } from './sections/RoomSection';

export interface SettingsPanelProps {
  roomCode: string;
  autoRandomEnabled: boolean;
  filters: RandomFilters;
  onAutoRandomToggle: (enabled: boolean) => void;
  onFiltersChange: (filters: Partial<RandomFilters>) => void;
  dragDropEnabled: boolean;
  onDragDropToggle: (enabled: boolean) => void;
  requesterPromptEnabled: boolean;
  onRequesterPromptToggle: (enabled: boolean) => void;
  mcEnabled: boolean;
  onMCToggle: (enabled: boolean) => void;
  mcVoice: string;
  onMcVoiceChange: (voice: string) => void;
  aiScoringEnabled: boolean;
  onAiScoringToggle: (enabled: boolean) => void;
  isHost: boolean;
  guestCanRemove: boolean;
  onGuestCanRemoveToggle: (enabled: boolean) => void;
  // Forwarded to the voice picker so it can cancel in-flight audio
  // preview when this panel stops being visible (e.g. user switches away
  // from the settings tab, or the modal wrapper closes).
  panelOpen: boolean;
  onLeave?: () => void;
}

export function SettingsPanel({
  roomCode,
  autoRandomEnabled,
  filters,
  onAutoRandomToggle,
  onFiltersChange,
  dragDropEnabled,
  onDragDropToggle,
  requesterPromptEnabled,
  onRequesterPromptToggle,
  mcEnabled,
  onMCToggle,
  mcVoice,
  onMcVoiceChange,
  aiScoringEnabled,
  onAiScoringToggle,
  isHost,
  guestCanRemove,
  onGuestCanRemoveToggle,
  panelOpen,
  onLeave,
}: SettingsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="px-5 py-5 space-y-6">
        {isHost && (
          <AutoRandomSection
            enabled={autoRandomEnabled}
            filters={filters}
            onToggle={onAutoRandomToggle}
            onFiltersChange={onFiltersChange}
          />
        )}

        {isHost && (
          <QueueSection
            dragDropEnabled={dragDropEnabled}
            onDragDropToggle={onDragDropToggle}
            requesterPromptEnabled={requesterPromptEnabled}
            onRequesterPromptToggle={onRequesterPromptToggle}
            guestCanRemove={guestCanRemove}
            onGuestCanRemoveToggle={onGuestCanRemoveToggle}
          />
        )}

        {isHost && (
          <AIMcSection
            enabled={mcEnabled}
            onToggle={onMCToggle}
            mcVoice={mcVoice}
            onMcVoiceChange={onMcVoiceChange}
            aiScoringEnabled={aiScoringEnabled}
            onAiScoringToggle={onAiScoringToggle}
            panelOpen={panelOpen}
          />
        )}

        <ThemeSection />

        <RoomSection code={roomCode} isHost={isHost} />

        {onLeave && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={onLeave}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/8 transition-colors"
            >
              <LogOut size={16} />
              {t('header.leaveButton')}
            </button>
          </div>
        )}
    </div>
  );
}

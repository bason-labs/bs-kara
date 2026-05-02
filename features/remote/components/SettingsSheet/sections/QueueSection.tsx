'use client';

import { GripVertical, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../primitives/SectionHeader';
import { ToggleRow } from '../primitives/ToggleRow';

interface QueueSectionProps {
  dragDropEnabled: boolean;
  onDragDropToggle: (enabled: boolean) => void;
  requesterPromptEnabled: boolean;
  onRequesterPromptToggle: (enabled: boolean) => void;
}

export function QueueSection({
  dragDropEnabled,
  onDragDropToggle,
  requesterPromptEnabled,
  onRequesterPromptToggle,
}: QueueSectionProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="settings-queue" className="space-y-2">
      <SectionHeader
        id="settings-queue"
        Icon={GripVertical}
        title={t('settings.sections.queue')}
      />
      <ToggleRow
        label={t('settings.dragDropLabel')}
        hint={t('settings.dragDropHint')}
        enabled={dragDropEnabled}
        onToggle={onDragDropToggle}
      />
      <ToggleRow
        Icon={Mic}
        label={t('settings.requesterPromptLabel')}
        hint={t('settings.requesterPromptHint')}
        enabled={requesterPromptEnabled}
        onToggle={onRequesterPromptToggle}
      />
    </section>
  );
}

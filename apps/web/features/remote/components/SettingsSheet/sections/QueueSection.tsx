'use client';

import { AudioLines, GripVertical, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../primitives/SectionHeader';
import { ToggleRow } from '../primitives/ToggleRow';

interface QueueSectionProps {
  dragDropEnabled: boolean;
  onDragDropToggle: (enabled: boolean) => void;
  requesterPromptEnabled: boolean;
  onRequesterPromptToggle: (enabled: boolean) => void;
  voiceChatEnabled: boolean;
  onVoiceChatToggle: (enabled: boolean) => void;
  guestCanRemove: boolean;
  onGuestCanRemoveToggle: (enabled: boolean) => void;
}

export function QueueSection({
  dragDropEnabled,
  onDragDropToggle,
  requesterPromptEnabled,
  onRequesterPromptToggle,
  voiceChatEnabled,
  onVoiceChatToggle,
  guestCanRemove,
  onGuestCanRemoveToggle,
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
      <ToggleRow
        Icon={AudioLines}
        label={t('settings.voiceChatLabel')}
        hint={t('settings.voiceChatHint')}
        enabled={voiceChatEnabled}
        onToggle={onVoiceChatToggle}
      />
      <ToggleRow
        label={t('settings.guestCanRemoveLabel')}
        hint={t('settings.guestCanRemoveHint')}
        enabled={guestCanRemove}
        onToggle={onGuestCanRemoveToggle}
      />
    </section>
  );
}

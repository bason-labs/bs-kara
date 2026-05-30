import { useTranslation } from 'react-i18next';
import { GripVertical, Mic } from 'lucide-react-native';
import { SectionLabel } from '../primitives/SectionLabel';
import { ToggleRow } from '../primitives/ToggleRow';

interface QueueSectionProps {
  dragDropEnabled: boolean;
  requesterPromptEnabled: boolean;
  guestCanRemove: boolean;
  onDragDropChange: (v: boolean) => void;
  onRequesterPromptChange: (v: boolean) => void;
  onGuestCanRemoveChange: (v: boolean) => void;
}

export function QueueSection({
  dragDropEnabled,
  requesterPromptEnabled,
  guestCanRemove,
  onDragDropChange,
  onRequesterPromptChange,
  onGuestCanRemoveChange,
}: QueueSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionLabel label={t('settings.sections.queue')} icon={GripVertical} />
      <ToggleRow
        testID="toggle-drag-drop"
        label={t('settings.dragDropLabel')}
        hint={t('settings.dragDropHint')}
        value={dragDropEnabled}
        onValueChange={onDragDropChange}
      />
      <ToggleRow
        icon={Mic}
        label={t('settings.requesterPromptLabel')}
        hint={t('settings.requesterPromptHint')}
        value={requesterPromptEnabled}
        onValueChange={onRequesterPromptChange}
      />
      <ToggleRow
        label={t('settings.guestCanRemoveLabel')}
        hint={t('settings.guestCanRemoveHint')}
        value={guestCanRemove}
        onValueChange={onGuestCanRemoveChange}
      />
    </>
  );
}

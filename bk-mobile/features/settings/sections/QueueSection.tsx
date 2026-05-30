import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
      <SectionLabel label={t('settings.sections.queue')} />
      <View style={{ marginHorizontal: 12, marginBottom: 4 }}>
        <ToggleRow
          testID="toggle-drag-drop"
          label={t('settings.dragDropLabel')}
          hint={t('settings.dragDropHint')}
          value={dragDropEnabled}
          onValueChange={onDragDropChange}
        />
        <ToggleRow
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
      </View>
    </>
  );
}

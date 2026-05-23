import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { TopBar } from '@/components/TopBar';
import { QueueItemRow } from '@/components/QueueItemRow';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { QueueItem } from '@bs-kara/shared';

export default function QueueScreen() {
  const { t } = useTranslation();
  const {
    roomData,
    roomCode,
    removeSong,
    reorderQueue,
    playSongNow,
    isHost,
  } = useRoomContext();

  const [pendingPlayNow, setPendingPlayNow] = useState<QueueItem | null>(null);

  function handleDragEnd({ from, to }: { from: number; to: number }) {
    reorderQueue(from, to);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
      <TopBar roomCode={roomCode} />

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ color: '#e0ffff', fontSize: 18, fontWeight: '700' }}>
          {t('queue.title')}
          {roomData.queue.length > 0 ? ` (${roomData.queue.length})` : ''}
        </Text>
      </View>

      {roomData.queue.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#7aa8a8', fontSize: 14 }}>{t('queue.emptyMessage')}</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={roomData.queue}
          keyExtractor={(item) => item.queueId}
          onDragEnd={handleDragEnd}
          renderItem={({ item, drag, getIndex }: RenderItemParams<QueueItem>) => (
            <QueueItemRow
              item={item}
              index={getIndex() ?? 0}
              queuePosition={(getIndex() ?? 0) + 1}
              onRemove={() => removeSong(item.queueId)}
              drag={drag}
              dragEnabled={roomData.dragDropEnabled}
              isHost={isHost}
              guestCanRemove={roomData.guestCanRemove ?? false}
              onPlayNow={isHost ? () => setPendingPlayNow(item) : undefined}
            />
          )}
        />
      )}

      <ConfirmDialog
        open={pendingPlayNow !== null}
        title={t('playNow.title')}
        message={t('playNow.message', { title: pendingPlayNow?.title ?? '' })}
        confirmLabel={t('playNow.confirm')}
        cancelLabel={t('playNow.cancel')}
        onConfirm={() => {
          if (pendingPlayNow) {
            void playSongNow(pendingPlayNow, pendingPlayNow.queueId);
            setPendingPlayNow(null);
          }
        }}
        onCancel={() => setPendingPlayNow(null)}
      />
    </SafeAreaView>
  );
}

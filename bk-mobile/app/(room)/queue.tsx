import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { TopBar } from '@/components/TopBar';
import { QueueItemRow } from '@/components/QueueItemRow';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { QueueItem } from '@bs-kara/shared';
import { useColors } from '@/hooks/useColors';

export default function QueueScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const {
    roomData,
    roomCode,
    removeSong,
    reorderQueue,
    playSongNow,
    isHost,
  } = useRoomContext();

  const [pendingRemove, setPendingRemove] = useState<QueueItem | null>(null);

  function handleDragEnd({ from, to }: { from: number; to: number }) {
    void reorderQueue(from, to);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar roomCode={roomCode} />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>
          {t('queue.title')}
          {roomData.queue.length > 0 ? ` (${roomData.queue.length})` : ''}
        </Text>
      </View>

      {roomData.queue.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 14 }}>{t('queue.emptyMessage')}</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={roomData.queue}
          keyExtractor={(item) => item.queueId}
          onDragEnd={handleDragEnd}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item, drag }: RenderItemParams<QueueItem>) => (
            <QueueItemRow
              item={item}
              onRemove={() => setPendingRemove(item)}
              drag={drag}
              dragEnabled={roomData.dragDropEnabled}
              isHost={isHost}
              currentPlayingId={roomData.currentPlaying?.id ?? null}
              onPlayNow={() => void playSongNow(item, item.queueId)}
            />
          )}
        />
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t('queue.removeConfirm.title')}
        message={t('queue.removeConfirm.message')}
        confirmLabel={t('queue.removeConfirm.confirm')}
        cancelLabel={t('queue.removeConfirm.cancel')}
        onConfirm={() => {
          if (pendingRemove) {
            void removeSong(pendingRemove.queueId);
            setPendingRemove(null);
          }
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </SafeAreaView>
  );
}

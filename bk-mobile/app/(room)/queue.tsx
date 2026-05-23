import { View, Text, SafeAreaView } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { RoomHeader } from '@/components/RoomHeader';
import { QueueItemRow } from '@/components/QueueItemRow';
import { EmojiPad } from '@/components/EmojiPad';
import { useSettingsContext } from '@/context/SettingsContext';
import type { QueueItem } from '@bs-kara/shared';

export default function QueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    roomData,
    roomCode,
    removeSong,
    reorderQueue,
    sendEmoji,
  } = useRoomContext();
  const { openSettings } = useSettingsContext();

  function handleDragEnd({ from, to }: { data: QueueItem[]; from: number; to: number }) {
    reorderQueue(from, to);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Shared header */}
      <RoomHeader
        roomCode={roomCode}
        onLeave={() => router.replace('/join' as never)}
        onSettings={openSettings}
      />

      {/* Queue title with count */}
      <View className="px-4 pb-2">
        <Text className="text-[#e0ffff] text-lg font-bold">
          {t('queue.title')}
          {roomData.queue.length > 0 ? ` (${roomData.queue.length})` : ''}
        </Text>
      </View>

      {/* Queue list */}
      {roomData.queue.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[#7aa8a8] text-sm">{t('queue.emptyMessage')}</Text>
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
              onRemove={() => removeSong(item.queueId)}
              drag={drag}
              dragEnabled={roomData.dragDropEnabled}
            />
          )}
        />
      )}

      {/* Emoji reactions */}
      <EmojiPad onSend={sendEmoji} />
    </SafeAreaView>
  );
}

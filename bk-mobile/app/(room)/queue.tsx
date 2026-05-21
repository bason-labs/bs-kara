import { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { NowPlayingCard } from '@/components/NowPlayingCard';
import { QueueItemRow } from '@/components/QueueItemRow';
import { EmojiPad } from '@/components/EmojiPad';
import { SettingsSheet } from '@/components/SettingsSheet';
import type { QueueItem } from '@bs-kara/shared';

export default function QueueScreen() {
  const { t } = useTranslation();
  const {
    roomData,
    togglePlayPause,
    removeSong,
    reorderQueue,
    sendEmoji,
  } = useRoomContext();
  const [settingsVisible, setSettingsVisible] = useState(false);

  function handleDragEnd({ from, to }: { data: QueueItem[]; from: number; to: number }) {
    reorderQueue(from, to);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Text className="text-[#e0ffff] text-lg font-bold flex-1">{t('queue.title')}</Text>
        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
          className="p-2"
        >
          <Settings size={20} color="#7aa8a8" />
        </TouchableOpacity>
      </View>

      {/* Now playing card */}
      <NowPlayingCard
        song={roomData.currentPlaying}
        isPlaying={roomData.isPlaying}
        onToggle={() => togglePlayPause(roomData.isPlaying)}
      />

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
          renderItem={({ item, drag }: RenderItemParams<QueueItem>) => (
            <QueueItemRow
              item={item}
              onRemove={() => removeSong(item.queueId)}
              drag={drag}
              dragEnabled={roomData.dragDropEnabled}
            />
          )}
        />
      )}

      {/* Emoji reactions */}
      <EmojiPad onSend={sendEmoji} />

      {/* Settings sheet */}
      <SettingsSheet isOpen={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

import { View, Text, SafeAreaView, Dimensions } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useRoomContext } from '@/context/RoomContext';
import { TransportControls } from '@/components/TransportControls';
import { EmojiPad } from '@/components/EmojiPad';

const { width } = Dimensions.get('window');
const PLAYER_HEIGHT = (width - 32) * (9 / 16);

export default function PlayerScreen() {
  const { roomData, togglePlayPause, playNext, playPrevious, sendEmoji } = useRoomContext();
  const { currentPlaying, isPlaying } = roomData;

  if (!currentPlaying) {
    return (
      <SafeAreaView className="flex-1 bg-[#06100f] items-center justify-center">
        <Text className="text-[#7aa8a8] text-sm text-center px-6">
          Chưa có bài nào đang phát — vào Tìm bài để chọn.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Song info */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-[#e0ffff] text-base font-semibold" numberOfLines={2}>
          {currentPlaying.title}
        </Text>
        {currentPlaying.requesterName ? (
          <Text className="text-[#7aa8a8] text-sm mt-1">{currentPlaying.requesterName}</Text>
        ) : null}
      </View>

      {/* YouTube embed */}
      <View className="mx-4 rounded-2xl overflow-hidden">
        <YoutubeIframe
          videoId={currentPlaying.id}
          height={PLAYER_HEIGHT}
          width={width - 32}
          play={isPlaying}
        />
      </View>

      {/* Transport controls */}
      <TransportControls
        isPlaying={isPlaying}
        onPlayPause={() => togglePlayPause(isPlaying)}
        onPrev={playPrevious}
        onNext={playNext}
      />

      {/* Emoji reactions */}
      <View className="mt-auto">
        <EmojiPad onSend={sendEmoji} />
      </View>
    </SafeAreaView>
  );
}

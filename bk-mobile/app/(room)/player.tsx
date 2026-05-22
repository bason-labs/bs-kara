import { View, Text, SafeAreaView, Image, TouchableOpacity, Dimensions } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Mic } from 'lucide-react-native';
import { useRoomContext } from '@/context/RoomContext';
import { RoomHeader } from '@/components/RoomHeader';
import { TransportControls } from '@/components/TransportControls';
import { EmojiPad } from '@/components/EmojiPad';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useState } from 'react';

const { width } = Dimensions.get('window');
const THUMB_HEIGHT = (width - 48) * (9 / 16);

export default function PlayerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { roomData, roomCode, togglePlayPause, playNext, playPrevious, sendEmoji } = useRoomContext();
  const { currentPlaying, isPlaying } = roomData;
  const [settingsVisible, setSettingsVisible] = useState(false);

  if (!currentPlaying) {
    return (
      <SafeAreaView className="flex-1 bg-[#06100f]">
        <RoomHeader
          roomCode={roomCode}
          onLeave={() => router.replace('/join' as never)}
          onSettings={() => setSettingsVisible(true)}
        />
        <View className="flex-1 items-center justify-center">
          <Text className="text-[#7aa8a8] text-sm text-center px-6">
            {t('player.idleHint')}
          </Text>
        </View>
        <SettingsSheet isOpen={settingsVisible} onClose={() => setSettingsVisible(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Hidden YouTube iframe — audio/video plays here */}
      <YoutubeIframe
        videoId={currentPlaying.id}
        height={0}
        width={0}
        play={isPlaying}
      />

      <RoomHeader
        roomCode={roomCode}
        onLeave={() => router.replace('/join' as never)}
        onSettings={() => setSettingsVisible(true)}
      />

      {/* Hero thumbnail */}
      <View className="mx-6 mt-2 mb-4 rounded-3xl overflow-hidden" style={{ height: THUMB_HEIGHT }}>
        <Image
          source={{ uri: currentPlaying.thumbnail }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* ĐANG PHÁT overlay */}
        <View className="absolute bottom-3 left-3 bg-black/50 rounded-full px-3 py-1">
          <Text className="text-[#40e0d0] text-[10px] uppercase tracking-[3px] font-semibold">
            {t('nowPlaying.label')}
          </Text>
        </View>
      </View>

      {/* Song info */}
      <View className="px-6 gap-1 mb-2">
        <Text className="text-[#e0ffff] text-base font-semibold" numberOfLines={2}>
          {currentPlaying.title}
        </Text>
        {currentPlaying.channel ? (
          <Text className="text-[#7aa8a8] text-xs">{currentPlaying.channel}</Text>
        ) : null}
        {currentPlaying.requesterName ? (
          <View className="flex-row items-center gap-1 self-start bg-[#008b8b26] rounded-full px-2 py-0.5 mt-1">
            <Mic size={11} color="#40e0d0" />
            <Text className="text-[#40e0d0] text-xs">{currentPlaying.requesterName}</Text>
          </View>
        ) : null}
      </View>

      {/* Skip current */}
      <TouchableOpacity
        onPress={playNext}
        activeOpacity={0.7}
        className="px-6 mb-3"
      >
        <Text className="text-[#7aa8a8] text-xs">{t('nowPlaying.removeAriaLabel')}</Text>
      </TouchableOpacity>

      {/* Emoji reactions */}
      <EmojiPad onSend={sendEmoji} />

      {/* Transport controls */}
      <TransportControls
        isPlaying={isPlaying}
        onPlayPause={() => togglePlayPause(isPlaying)}
        onPrev={playPrevious}
        onNext={playNext}
      />

      <SettingsSheet isOpen={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { TopBar } from '@/components/TopBar';
import { NowPlayingCard } from '@/components/NowPlayingCard';
import { RemoteControls } from '@/components/RemoteControls';
import { FullscreenPlayer } from '@/components/FullscreenPlayer';
import { EmojiPad } from '@/components/EmojiPad';
import { useColors } from '@/hooks/useColors';

export default function PlayerScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { roomData, roomCode, togglePlayPause, setIsPlaying, playNext, playPrevious, sendEmoji } = useRoomContext();
  const { currentPlaying, isPlaying, isTvActive, history, queue } = roomData;
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  if (!currentPlaying) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar roomCode={roomCode} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 }}>
            {t('player.idleHint')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Background audio driver — suppressed while fullscreen is open (FullscreenPlayer has its own iframe + MC gate). */}
      {!isTvActive && !fullscreenOpen && (
        <YoutubeIframe videoId={currentPlaying.id} height={0} width={0} play={isPlaying} />
      )}

      <TopBar roomCode={roomCode} />

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <NowPlayingCard
          song={currentPlaying}
          isPlaying={isPlaying}
          onToggle={() => void togglePlayPause(isPlaying)}
          variant="hero"
          onExpand={() => {
            setFullscreenOpen(true);
            void setIsPlaying(true);
          }}
          isTvActive={isTvActive}
          onSkip={playNext}
        />
      </View>

      <EmojiPad onSend={sendEmoji} />

      <RemoteControls
        isPlaying={isPlaying}
        hasHistory={(history?.length ?? 0) > 0}
        hasQueue={queue.length > 0}
        onPlayPause={() => void togglePlayPause(isPlaying)}
        onPrev={playPrevious}
        onNext={playNext}
      />

      {fullscreenOpen && !isTvActive && (
        <FullscreenPlayer
          videoId={currentPlaying.id}
          isPlaying={isPlaying}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

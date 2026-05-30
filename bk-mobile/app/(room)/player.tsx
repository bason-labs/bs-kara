import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { TopBar } from '@/components/TopBar';
import { NowPlayingCard } from '@/components/NowPlayingCard';
import { RemoteControls } from '@/components/RemoteControls';
import { FullscreenPlayer } from '@/components/FullscreenPlayer';
import { EmojiPad } from '@/components/EmojiPad';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';

export default function PlayerScreen() {
  const { t } = useTranslation();
  const { roomData, roomCode, togglePlayPause, setIsPlaying, playNext, playPrevious, sendEmoji, tryClaimAnnouncementLock } = useRoomContext();
  const { currentPlaying, isPlaying, isTvActive, history, queue, isMCEnabled, mcVoice } = roomData;
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: currentPlaying ?? null,
    ready: !isTvActive,
    mcVoice,
    tryClaimAnnouncementLock,
  });

  if (!currentPlaying) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
        <TopBar roomCode={roomCode} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#7aa8a8', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 }}>
            {t('player.idleHint')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
      {!isTvActive && !isMcGated && (
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
            setIsPlaying(true);
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

      {isMcGated && !isTvActive && (
        <MCAnnouncementOverlay
          variant="phone"
          title={currentPlaying.title}
          requesterName={currentPlaying.requesterName}
          mcText={mcText ?? undefined}
        />
      )}

      {fullscreenOpen && !isTvActive && (
        <FullscreenPlayer
          videoId={currentPlaying.id}
          isPlaying={isPlaying}
          isMcGated={isMcGated}
          mcTitle={currentPlaying.title}
          mcRequesterName={currentPlaying.requesterName}
          mcText={mcText ?? undefined}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

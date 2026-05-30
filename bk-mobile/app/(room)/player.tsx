import { useEffect, useRef, useState } from 'react';
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

export default function PlayerScreen() {
  const { t } = useTranslation();
  const { roomData, roomCode, togglePlayPause, setIsPlaying, playNext, playPrevious, sendEmoji, tryClaimAnnouncementLock } = useRoomContext();
  const { currentPlaying, isPlaying, isTvActive, history, queue, isMCEnabled, mcVoice } = roomData;
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // MC only fires when fullscreen is open — the overlay lives inside FullscreenPlayer.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: currentPlaying ?? null,
    ready: !isTvActive && fullscreenOpen,
    mcVoice,
    tryClaimAnnouncementLock,
  });

  // Kick-play: when the MC gate drops (true → false) inside fullscreen, ensure
  // the video autoplays even if Firebase isPlaying drifted to false mid-announcement.
  const prevMcGatedRef = useRef(false);
  useEffect(() => {
    if (prevMcGatedRef.current && !isMcGated && fullscreenOpen) {
      void setIsPlaying(true);
    }
    prevMcGatedRef.current = isMcGated;
  }, [isMcGated, fullscreenOpen, setIsPlaying]);

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
      {/* Background audio driver — suppress while fullscreen is open (it has its own iframe). */}
      {!isTvActive && !isMcGated && !fullscreenOpen && (
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

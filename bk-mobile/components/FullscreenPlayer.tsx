import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  AccessibilityInfo,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YoutubeIframe, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useAdMask } from '@/hooks/useAdMask';
import { AdIntermissionOverlay } from '@/components/AdIntermissionOverlay';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';
import { useColors } from '@/hooks/useColors';

const ROTATE_HINT_KEY = 'bsk_seenRotateHint';

interface FullscreenPlayerProps {
  videoId: string;
  isPlaying: boolean;
  onClose: () => void;
}

export function FullscreenPlayer({ videoId, isPlaying, onClose }: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const { roomData, setIsPlaying } = useRoomContext();
  const { currentPlaying, isMCEnabled, mcVoice } = roomData;
  const c = useColors();

  const playerRef = useRef<YoutubeIframeRef>(null);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  // Android System WebView blocks UNMUTED autoplay without an in-document user
  // gesture (Chromium + YouTube IFrame policy), so on Android we start the song
  // playing MUTED — which is allowed — and unmute once the user taps the player
  // (a real in-frame gesture; YouTube's native tap-to-unmute). iOS (WKWebView)
  // permits programmatic unmuted autoplay, so it starts unlocked.
  const [audioUnlocked, setAudioUnlocked] = useState(Platform.OS !== 'android');
  const [showHint, setShowHint] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Local play state — starts from the Firebase value but flips to true
  // immediately when MC finishes, without waiting for Firebase round-trip.
  const [shouldPlay, setShouldPlay] = useState(isPlaying);
  const { width, height } = useWindowDimensions();
  // useWindowDimensions updates after the orientation lock fires.
  // In landscape: width > height → fills the screen at the correct aspect.
  const playerWidth = width;
  const playerHeight = height;

  // MC is fully owned here. This component only mounts when fullscreen is open,
  // so ready=true avoids any ready-prop race that caused immediate gate closure.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: currentPlaying ?? null,
    ready: true,
    mcVoice,
  });

  // Clear the local playing flag the instant the track changes, so the ad
  // probe (which treats a current/requested id mismatch as an ad) does not arm
  // on the new videoId while the iframe still reports the previous song —
  // otherwise a normal queue advance briefly looks like an ad.
  useEffect(() => {
    setPlayerPlaying(false);
  }, [videoId]);

  // Ad masking: mute + cover the embed while an ad plays. Disarmed during the
  // MC gate (MC precedence), while paused (shouldPlay), and until the new track
  // actually reaches PLAYING (playerPlaying).
  const { isAdGated } = useAdMask(playerRef, videoId, !isMcGated && shouldPlay && playerPlaying);

  // Keep shouldPlay in sync with Firebase isPlaying (for pause from other controls).
  useEffect(() => {
    setShouldPlay(isPlaying);
  }, [isPlaying]);

  // Kick-play: when MC gate drops (true → false), flip shouldPlay immediately
  // and also write to Firebase so other devices stay in sync. On Android the
  // resume is muted (audioUnlocked is false) so the WebView autoplay policy
  // allows it; the video rolls instead of freezing on the play button.
  const prevMcGatedRef = useRef(false);
  useEffect(() => {
    if (prevMcGatedRef.current && !isMcGated) {
      setShouldPlay(true);
      void setIsPlaying(true);
    }
    prevMcGatedRef.current = isMcGated;
  }, [isMcGated, setIsPlaying]); // shouldPlay intentionally omitted — read at fire time via closure

  // Android only: the song plays muted until the user taps the player to unmute
  // (YouTube's native tap-to-unmute — the one gesture the autoplay policy
  // accepts). We can't observe that tap directly (the library owns onMessage),
  // so poll isMuted() and, once the player reports unmuted, flip audioUnlocked
  // so the mute prop stops asserting mute and the ad gate regains control.
  useEffect(() => {
    if (audioUnlocked) return;
    let cancelled = false;
    const id = setInterval(() => {
      void (async () => {
        try {
          const muted = await playerRef.current?.isMuted();
          // Guard against a late isMuted() resolving after unmount / unlock,
          // which would setState on an unmounted component (matches the
          // cancelled-flag pattern in useAdMask / useMCPlayer).
          if (!cancelled && muted === false) setAudioUnlocked(true);
        } catch {
          // player mid-teardown; ignore and retry next tick
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [audioUnlocked]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (mounted) setReduceMotion(val);
    });
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => {});
    AsyncStorage.getItem(ROTATE_HINT_KEY).then((seen) => {
      if (!seen && mounted) {
        setShowHint(true);
        void AsyncStorage.setItem(ROTATE_HINT_KEY, '1');
      }
    });
    return () => {
      mounted = false;
      void ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {/* Always mounted so the WebView initialises during the MC overlay.
            play=false keeps it audio-silent while isMcGated; the MC overlay
            sits above it in z-order. When isMcGated drops, play flips true
            on an already-ready player — no fresh-mount timing race. */}
        <YoutubeIframe
          ref={playerRef}
          videoId={videoId}
          height={playerHeight}
          width={playerWidth}
          play={!isMcGated && shouldPlay}
          mute={isMcGated || isAdGated || !audioUnlocked}
          webViewStyle={{ backgroundColor: '#000' }}
          forceAndroidAutoplay
          onReady={() => {}}
          onChangeState={(state: string) => setPlayerPlaying(state === PLAYER_STATES.PLAYING)}
        />

        {isMcGated && currentPlaying && (
          <MCAnnouncementOverlay
            variant="phone"
            title={currentPlaying.title}
            requesterName={currentPlaying.requesterName}
            mcText={mcText ?? undefined}
            onClose={onClose}
          />
        )}

        {isAdGated && !isMcGated && (
          <AdIntermissionOverlay nextSongTitle={roomData.queue[0]?.title ?? null} />
        )}

        {/* Android plays muted until the user taps the player to unmute. This
            hint must NOT intercept that tap, so it is pointer-events: none and
            sits at the top, leaving the player surface tappable. */}
        {!audioUnlocked && !isMcGated && !isAdGated && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 16,
              alignSelf: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
              {t('player.tapForSound')}
            </Text>
          </View>
        )}

        {!isMcGated && (
          <SafeAreaView style={{ position: 'absolute', top: 0, right: 0 }}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              style={{
                margin: 12,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,0,0,0.6)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {showHint && !isMcGated && (
          <View
            style={{
              position: 'absolute',
              bottom: 32,
              alignSelf: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: c.fg, fontSize: 13 }}>
              {t('player.rotateHint', '↻ Xoay điện thoại')}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

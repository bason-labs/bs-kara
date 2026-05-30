import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ref, onChildAdded, query, orderByChild, startAfter } from 'firebase/database';
import { db, getRoomDataPath, getGifUrl } from '@bs-kara/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

interface IncomingReaction {
  reactionId: string;
  emojiType: string;
}

interface ActiveReaction {
  id: string;
  emoji: string;
  leftPct: number;
  sway: number;
  rotation: number;
  scalePeak: number;
  duration: number;
}

export interface EmojiLayerProps {
  roomId: string;
}

export interface EmojiLayerHandle {
  pushLocal: (emoji: string) => void;
}

// Visible-cap: total active + queued reactions allowed at once. Drops the
// oldest in the queue when exceeded so a fresh tap is always shown.
const VISIBLE_CAP = 12;
// Local-key entries older than this are pruned. Sized comfortably above the
// expected Firebase echo round-trip (~300–600 ms).
const LOCAL_KEY_TTL_MS = 10_000;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildActive(item: IncomingReaction): ActiveReaction {
  const swayMag = rand(45, 90);
  return {
    id: item.reactionId,
    emoji: item.emojiType,
    leftPct: rand(8, 92),
    sway: Math.random() < 0.5 ? -swayMag : swayMag,
    rotation: rand(-22, 22),
    scalePeak: rand(0.95, 1.4),
    duration: rand(4.2, 5.6),
  };
}

interface EmojiRiserProps {
  reaction: ActiveReaction;
  screenHeight: number;
  onFinished: (id: string) => void;
}

function EmojiRiser({ reaction, screenHeight, onFinished }: EmojiRiserProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const durationMs = reaction.duration * 1000;
    const riseDistance = screenHeight * 0.75;

    Animated.parallel([
      // Rise upward
      Animated.timing(translateY, {
        toValue: -riseDistance,
        duration: durationMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Sinusoidal sway: go to full sway at midpoint, return to 0 at end
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: reaction.sway,
          duration: durationMs * 0.5,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: durationMs * 0.5,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      // Opacity: stay solid for 60%, then fade out
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: durationMs * 0.6,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: durationMs * 0.4,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      // Scale: grow to scalePeak quickly, then settle back to 1
      Animated.sequence([
        Animated.timing(scale, {
          toValue: reaction.scalePeak,
          duration: durationMs * 0.2,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: durationMs * 0.2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Hold at 1 for remaining time (covered by the parallel opacity fade)
        Animated.timing(scale, {
          toValue: 1,
          duration: durationMs * 0.6,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        onFinished(reaction.id);
      }
    });
  // The animation runs once per mount of this component instance.
  // `reaction` values are captured at mount and intentionally not re-run.
  }, []);

  const leftOffset = `${reaction.leftPct}%` as `${number}%`;

  const gifUri = `${API_BASE}${getGifUrl(reaction.emoji)}`;

  return (
    <Animated.View
      style={[
        styles.riser,
        {
          // leftPct as a percentage of container width, offset by half the image size
          left: leftOffset,
          marginLeft: -32,
          bottom: screenHeight * 0.06,
          transform: [
            { translateY },
            { translateX },
            { scale },
            { rotate: `${reaction.rotation}deg` },
          ],
          opacity,
        },
      ]}
    >
      <Image
        source={{ uri: gifUri }}
        style={styles.gifImage}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export const EmojiLayer = forwardRef<EmojiLayerHandle, EmojiLayerProps>(
  function EmojiLayer({ roomId }, ref_) {
    const { height: screenHeight } = useWindowDimensions();
    const [reactionQueue, setReactionQueue] = useState<IncomingReaction[]>([]);
    const [activeElements, setActiveElements] = useState<ActiveReaction[]>([]);
    const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Self-echo dedupe. Key format: `${emoji}@${timestamp}@${counter}` where
    // counter is a per-instance monotonic so taps within the same ms stay
    // unique. Known limitation: two users tapping the SAME emoji on the SAME
    // millisecond on different devices will collide — one device will swallow
    // the other's echo. Acceptable: the cross-user collision window is ~1 ms
    // and the failure mode is one missed remote rise, not a crash.
    const localKeysRef = useRef<Map<string, number>>(new Map());
    const localCounterRef = useRef(0);

    const removeActive = useCallback((id: string) => {
      setActiveElements((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const enqueue = useCallback((item: IncomingReaction) => {
      setReactionQueue((prev) => {
        const next = [...prev, item];
        // Drop-oldest cap covering queued + active so we can't backlog
        // animations after a spam burst.
        while (next.length > VISIBLE_CAP) next.shift();
        return next;
      });
    }, []);

    useImperativeHandle(
      ref_,
      () => ({
        pushLocal: (emoji: string) => {
          const ts = Date.now();
          const counter = ++localCounterRef.current;
          const dedupeKey = `${emoji}@${ts}@${counter}`;
          localKeysRef.current.set(dedupeKey, ts);
          enqueue({ reactionId: `local-${dedupeKey}`, emojiType: emoji });
        },
      }),
      [enqueue],
    );

    // Listener: enqueue only — never render directly
    useEffect(() => {
      const q = query(
        ref(db, `${getRoomDataPath(roomId)}/emojis`),
        orderByChild('timestamp'),
        startAfter(Date.now()),
      );

      const unsub = onChildAdded(q, (snap) => {
        const data = snap.val() as { emoji?: string; timestamp?: number } | null;
        if (!data?.emoji) return;

        // Prune stale local-key entries before checking, so the Map doesn't
        // grow unbounded under sustained tapping.
        const now = Date.now();
        for (const [k, t] of localKeysRef.current) {
          if (now - t > LOCAL_KEY_TTL_MS) localKeysRef.current.delete(k);
        }

        // Self-echo dedupe: if any local key matches this (emoji, timestamp),
        // consume it and skip enqueueing — we already showed it optimistically.
        if (typeof data.timestamp === 'number') {
          for (const [k, t] of localKeysRef.current) {
            if (t === data.timestamp && k.startsWith(`${data.emoji}@${data.timestamp}@`)) {
              localKeysRef.current.delete(k);
              return;
            }
          }
        }

        enqueue({ reactionId: snap.key!, emojiType: data.emoji! });
      });

      return unsub;
    }, [roomId, enqueue]);

    // Drain loop: pop one reaction every 150–250ms so they appear staggered
    // even when many arrive in the same tick.
    useEffect(() => {
      if (reactionQueue.length === 0 || drainTimerRef.current) return;

      const head = reactionQueue[0];
      const stagger = rand(150, 250);

      drainTimerRef.current = setTimeout(() => {
        drainTimerRef.current = null;
        const reaction = buildActive(head);
        setActiveElements((prev) => {
          const next = [...prev, reaction];
          while (next.length > VISIBLE_CAP) next.shift();
          return next;
        });
        setReactionQueue((prev) => prev.slice(1));
        // Safety-net cleanup in case the animation callback never fires
        setTimeout(() => removeActive(reaction.id), reaction.duration * 1000 + 600);
      }, stagger);
    }, [reactionQueue, removeActive]);

    useEffect(() => {
      return () => {
        if (drainTimerRef.current) {
          clearTimeout(drainTimerRef.current);
          drainTimerRef.current = null;
        }
      };
    }, []);

    return (
      <View style={styles.container} pointerEvents="none">
        {activeElements.map((r) => (
          <EmojiRiser
            key={r.id}
            reaction={r}
            screenHeight={screenHeight}
            onFinished={removeActive}
          />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    overflow: 'hidden',
  },
  riser: {
    position: 'absolute',
  },
  gifImage: {
    width: 64,
    height: 64,
  },
});

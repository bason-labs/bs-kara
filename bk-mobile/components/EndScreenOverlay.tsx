import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ScoreResult } from '@bs-kara/shared';
import { ScoreBlock } from '@/components/ScoreBlock';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSAGES = [
  { headline: '🎤 Bạn hát tuyệt vời!', subline: 'Cả phòng vỗ tay nào! 👏' },
  { headline: '⭐ Như ca sĩ luôn!', subline: 'Một tràng pháo tay! 👏👏👏' },
  { headline: '🔥 Cháy quá!', subline: 'Cùng cụng ly nào! 🥂' },
  { headline: '🎵 Giọng vàng đó nha!', subline: 'Tuyệt vời ông mặt trời! ☀️' },
  { headline: '✨ Hát hay quá!', subline: 'Vỗ tay khen người hát! 👏' },
  { headline: '💫 Diva phòng karaoke!', subline: 'Cả nhà cùng nhau vỗ tay! 👏👏' },
  { headline: '🏆 Quán quân phòng này!', subline: 'Bùng cháy hết mình! 🔥' },
  { headline: '🎉 Quá xuất sắc!', subline: 'Một bài hát đỉnh của đỉnh! ⭐' },
] as const;

const TRIGGER_SECONDS_BEFORE_END = 8;
const POLL_INTERVAL_MS = 250;

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#ffffff'];

// ---------------------------------------------------------------------------
// Lightweight confetti particle
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  size: number;
  startX: number;
}

function createParticles(count: number, containerWidth: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const startX = Math.random() * containerWidth;
    return {
      id: i,
      x: new Animated.Value(startX),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      startX,
    };
  });
}

function animateParticles(particles: Particle[], containerHeight: number) {
  particles.forEach((p) => {
    // Reset to starting state
    p.y.setValue(0);
    p.opacity.setValue(1);
    p.scale.setValue(0);
    const drift = (Math.random() - 0.5) * 80;
    const duration = 1200 + Math.random() * 1000;

    Animated.parallel([
      Animated.timing(p.y, {
        toValue: containerHeight + 40,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(p.x, {
        toValue: p.startX + drift,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(p.scale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: duration - 150,
          delay: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  });
}

interface ConfettiBurstProps {
  fire: boolean;
}

function ConfettiBurst({ fire }: ConfettiBurstProps) {
  const containerRef = useRef<View>(null);
  const [layout, setLayout] = useState({ width: 300, height: 600 });
  const particles = useRef<Particle[]>([]);
  const initialized = useRef(false);

  // Build particles once we have layout
  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
    if (!initialized.current) {
      particles.current = createParticles(60, width);
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (!fire || !initialized.current) return;
    // First burst immediately, two follow-up bursts
    animateParticles(particles.current, layout.height);
    const t1 = setTimeout(() => animateParticles(particles.current, layout.height), 1500);
    const t2 = setTimeout(() => animateParticles(particles.current, layout.height), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fire, layout.height]);

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
    >
      {initialized.current && particles.current.map((p) => (
        <Animated.View
          key={p.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 4,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shimmer-title shimmer animation via moving LinearGradient
// ---------------------------------------------------------------------------

function ShimmerHeadline({ text }: { text: string }) {
  const shimmerX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false, // LinearGradient input-range requires JS driver
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerX]);

  // We can't do WebkitBackgroundClip text gradient in RN.
  // Instead, we overlay a semi-transparent LinearGradient on the text
  // and animate its horizontal position to simulate the shimmer sweep.
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 52,
          fontWeight: '900',
          color: '#FFD700',
          textAlign: 'center',
          letterSpacing: -0.5,
          lineHeight: 64,
          textShadowColor: 'rgba(255, 215, 0, 0.4)',
          textShadowOffset: { width: 0, height: 4 },
          textShadowRadius: 24,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface EndScreenOverlayProps {
  player: { getCurrentTime: () => number; getDuration: () => number } | null;
  songId: string | null;
  nextSongTitle?: string | null;
  onVisibleChange?: (visible: boolean) => void;
  score?: ScoreResult | null;
}

function pickMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export function EndScreenOverlay({
  player,
  songId,
  nextSongTitle,
  onVisibleChange,
  score,
}: EndScreenOverlayProps): ReactElement | null {
  const c = useColors();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<typeof MESSAGES[number]>(pickMessage);

  // Re-arming gate: only fire once we've seen the player report a position
  // comfortably away from the end for the current songId. This prevents a
  // stale YouTubePlayer reference from leaking the previous song's near-end
  // values into the new song's gate.
  const seenEarlyRef = useRef(false);

  // Animated values — created once and reused across visibility cycles.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(0.7)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // Reset on song change
  useEffect(() => {
    setVisible(false);
    setMessage(pickMessage());
    seenEarlyRef.current = false;
  }, [songId]);

  // Notify parent
  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  // Poll player position
  useEffect(() => {
    if (!player || !songId) return;
    const id = setInterval(() => {
      const current = player.getCurrentTime();
      const duration = player.getDuration();
      // Skip very short clips
      if (!duration || duration < TRIGGER_SECONDS_BEFORE_END * 2) return;
      const remaining = duration - current;
      // Arm only after the player reports a non-near-end position
      if (!seenEarlyRef.current) {
        if (remaining > TRIGGER_SECONDS_BEFORE_END * 2) {
          seenEarlyRef.current = true;
        }
        return;
      }
      if (remaining <= TRIGGER_SECONDS_BEFORE_END && remaining > 0) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [player, songId]);

  // Run entrance animations when overlay becomes visible
  useEffect(() => {
    if (!visible) {
      // Reset all animated values so the next visibility cycle starts fresh
      fadeAnim.setValue(0);
      popScale.setValue(0.7);
      popOpacity.setValue(0);
      pulseScale.setValue(1);
      footerOpacity.setValue(0);
      return;
    }

    // Overlay fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Headline pop
    Animated.parallel([
      Animated.timing(popScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.timing(popOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Subline emoji pulse loop
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.2,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnim.start();

    // Footer delayed fade-in
    Animated.timing(footerOpacity, {
      toValue: 1,
      duration: 800,
      delay: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    return () => {
      pulseAnim.stop();
    };
  }, [visible, fadeAnim, popScale, popOpacity, pulseScale, footerOpacity]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      visible={visible}
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}
        // Swallow touches so they don't fall through to underlying content
        pointerEvents="auto"
      >
        <LinearGradient
          colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, styles.container]}
        >
          {/* Confetti particles */}
          <ConfettiBurst fire={visible} />

          {/* Headline block */}
          <Animated.View
            pointerEvents="none"
            style={{
              alignItems: 'center',
              paddingHorizontal: 32,
              opacity: popOpacity,
              transform: [{ scale: popScale }],
            }}
          >
            <ShimmerHeadline text={message.headline} />

            <Animated.Text
              style={{
                fontSize: 22,
                fontWeight: '600',
                color: '#ffffff',
                textAlign: 'center',
                marginTop: 16,
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 12,
                transform: [{ scale: pulseScale }],
              }}
            >
              {message.subline}
            </Animated.Text>
          </Animated.View>

          {/* Score block */}
          {score ? (
            <View pointerEvents="none" style={{ marginTop: 32 }}>
              <ScoreBlock score={score} />
            </View>
          ) : null}

          {/* Footer teaser */}
          <Animated.View
            pointerEvents="none"
            style={[styles.footer, { opacity: footerOpacity }]}
          >
            {nextSongTitle ? (
              <Text style={styles.footerText}>
                {'🎵 Bài tiếp theo: '}
                <Text style={styles.footerBold}>{nextSongTitle}</Text>
              </Text>
            ) : (
              <Text style={styles.footerText}>🎤 Cảm ơn đã hát!</Text>
            )}
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  footerText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  footerBold: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

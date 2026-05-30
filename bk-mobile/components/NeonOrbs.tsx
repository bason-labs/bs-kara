/* Decorative animated orbs — React Native port of the bk-web NeonOrbs.
   Respects the system "Reduce Motion" accessibility setting.
   Three independently drifting blurred circles approximate the CSS
   radial-gradient + filter:blur effect using expo-linear-gradient
   (radial-ish via a square gradient sized to fill a circle) combined
   with a blurRadius tint on the Image layer — or simply a semi-transparent
   circle when LinearGradient alone is sufficient.
*/

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export interface NeonOrbsProps {
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Sizing helpers
// ---------------------------------------------------------------------------

function vmax(factor: number): number {
  const { width, height } = Dimensions.get('window');
  return Math.max(width, height) * factor;
}

// ---------------------------------------------------------------------------
// Individual orb
// ---------------------------------------------------------------------------

interface OrbProps {
  /** Circle diameter in pixels */
  size: number;
  /** Absolute position offsets (negative allowed — orb bleeds off-screen) */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  opacity: number;
  /** Gradient colors: center → transparent */
  colors: readonly [string, string];
  /** Translation range for the drift animation */
  driftX: number;
  driftY: number;
  /** Scale at the "to" keyframe */
  scaleTo: number;
  /** Duration of one half-cycle (forward), seconds */
  durationSec: number;
  reduceMotion: boolean;
}

function Orb({
  size,
  top,
  bottom,
  left,
  right,
  opacity,
  colors,
  driftX,
  driftY,
  scaleTo,
  durationSec,
  reduceMotion,
}: OrbProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;

    const durationMs = durationSec * 1000;

    // Alternate: forward then reverse, looping indefinitely
    const makeAnim = (
      val: Animated.Value,
      toValue: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue,
            duration: durationMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: durationMs,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: scaleTo,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const xAnim = makeAnim(translateX, driftX);
    const yAnim = makeAnim(translateY, driftY);

    Animated.parallel([xAnim, yAnim, scaleAnim]).start();

    return () => {
      xAnim.stop();
      yAnim.stop();
      scaleAnim.stop();
    };
  }, [reduceMotion, driftX, driftY, scaleTo, durationSec, translateX, translateY, scale]);

  const positionStyle: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity,
    overflow: 'hidden',
    ...(top !== undefined ? { top } : {}),
    ...(bottom !== undefined ? { bottom } : {}),
    ...(left !== undefined ? { left } : {}),
    ...(right !== undefined ? { right } : {}),
  };

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[
        positionStyle,
        {
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
        },
      ]}
    >
      {/* expo-linear-gradient approximates the radial-gradient centre fade.
          We use a radial-ish approximation with start/end centred. */}
      <LinearGradient
        colors={[colors[0], colors[1]] as [string, string]}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function NeonOrbs({ style }: NeonOrbsProps) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? DarkColors : LightColors;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Orb sizes are expressed as fractions of vmax, matching the CSS vmax units.
  const sizeA = vmax(0.38);
  const sizeB = vmax(0.42);
  const sizeC = vmax(0.28);

  // Drift distances mirror the CSS @keyframes translate values.
  const driftUnit = vmax(0.06); // ~6vmax

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* orb-a: top-left */}
      <Orb
        key="orb-a"
        size={sizeA}
        top={-(sizeA * 0.08)}
        left={-(sizeA * 0.1)}
        opacity={0.55}
        colors={[`${colors.brand}cc`, 'transparent']}
        driftX={driftUnit}
        driftY={vmax(0.04)}
        scaleTo={1.1}
        durationSec={22}
        reduceMotion={reduceMotion}
      />
      {/* orb-b: bottom-right */}
      <Orb
        key="orb-b"
        size={sizeB}
        bottom={-(sizeB * 0.12)}
        right={-(sizeB * 0.08)}
        opacity={0.55}
        colors={[`${colors.accent}cc`, 'transparent']}
        driftX={-vmax(0.05)}
        driftY={-vmax(0.06)}
        scaleTo={1.08}
        durationSec={28}
        reduceMotion={reduceMotion}
      />
      {/* orb-c: centre — offset by half its size to approximate translate(-50%,-50%) */}
      <Orb
        key="orb-c"
        size={sizeC}
        top={Dimensions.get('window').height * 0.35 - sizeC / 2}
        left={Dimensions.get('window').width * 0.5 - sizeC / 2}
        opacity={0.32}
        colors={[`${colors.glow}88`, 'transparent']}
        driftX={-vmax(0.08)}
        driftY={vmax(0.08)}
        scaleTo={1.15}
        durationSec={34}
        reduceMotion={reduceMotion}
      />
    </View>
  );
}

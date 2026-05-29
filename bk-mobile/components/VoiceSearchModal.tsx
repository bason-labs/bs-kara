import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mic, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceSearchModalProps {
  visible: boolean;
  interimTranscript: string;
  onClose: () => void;
  suggestions?: string[];
}

function PulseDot() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    return () => anim.stopAnimation();
  }, [anim]);

  const ringScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 6, height: 6, borderRadius: 3,
        backgroundColor: 'rgba(64,224,208,0.4)',
        transform: [{ scale: ringScale }], opacity: ringOpacity,
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#40e0d0' }} />
    </View>
  );
}

function BlinkCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
    return () => opacity.stopAnimation();
  }, [opacity]);
  return (
    <Animated.Text style={{ color: '#7df9ff', fontSize: 20, fontWeight: '600', opacity }}>|</Animated.Text>
  );
}

function MicOrb() {
  // Compact orb sized for a bounded dialog card (was 168×168 / 96 mic in the
  // previous full-screen overlay layout).
  const ORB_SIZE = 128;
  const MIC_SIZE = 72;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeRing = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const r1 = makeRing(ring1, 0);
    const r2 = makeRing(ring2, 800);
    r1.start(); r2.start();
    return () => { r1.stop(); r2.stop(); };
  }, [ring1, ring2]);

  const ringStyle = (val: Animated.Value) => ({
    position: 'absolute' as const,
    width: ORB_SIZE, height: ORB_SIZE, borderRadius: ORB_SIZE / 2,
    borderWidth: 1, borderColor: 'rgba(125,249,255,0.25)',
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
  });

  return (
    <View style={{ width: ORB_SIZE, height: ORB_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#7df9ff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 12,
        }}
      >
        <Mic size={28} color="#fff" />
      </LinearGradient>
    </View>
  );
}

export function VoiceSearchModal({
  visible, interimTranscript, onClose, suggestions = [],
}: VoiceSearchModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        testID="voice-backdrop"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#0e1c1c',
            borderRadius: 20,
            padding: 24,
            gap: 18,
            overflow: 'hidden',
          }}>
            {/* Header: title + close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#e0ffff', fontSize: 16, fontWeight: '700' }}>
                {t('voice.title')}
              </Text>
              <TouchableOpacity testID="voice-close-button" onPress={onClose} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#7aa8a8" />
              </TouchableOpacity>
            </View>

            {/* Mic orb */}
            <View style={{ alignItems: 'center', paddingVertical: 4 }}>
              <MicOrb />
            </View>

            {/* Transcript (only when recognizing) */}
            {interimTranscript ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 28 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#e0ffff',
                  textAlign: 'center', lineHeight: 24 }}>
                  {interimTranscript}
                </Text>
                <BlinkCursor />
              </View>
            ) : null}

            {/* Hint row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <PulseDot />
              <Text style={{ fontSize: 13, color: '#7aa8a8' }}>
                {interimTranscript ? t('voice.recognizing') : t('voice.hint')}
              </Text>
            </View>

            {/* Suggestion chips */}
            {suggestions.length > 0 && !interimTranscript && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <View key={s} style={{ backgroundColor: '#152a2a', borderRadius: 999,
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: 1, borderColor: '#1f3a3a' }}>
                    <Text style={{ fontSize: 11, color: '#7aa8a8' }}>"{s}"</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Cancel button */}
            <TouchableOpacity testID="voice-cancel-button" onPress={onClose} activeOpacity={0.7}
              style={{ paddingVertical: 12, borderRadius: 12, borderWidth: 1,
                borderColor: '#1f3a3a', alignItems: 'center' }}>
              <Text style={{ color: '#7aa8a8', fontWeight: '600' }}>{t('voice.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

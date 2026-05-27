import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
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
    <Animated.Text style={{ color: '#7df9ff', fontSize: 24, fontWeight: '600', opacity }}>|</Animated.Text>
  );
}

function MicOrb() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeRing = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, { toValue: 1, duration: 17000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(driftAnim, { toValue: 0, duration: 17000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const r1 = makeRing(ring1, 0);
    const r2 = makeRing(ring2, 800);
    r1.start(); r2.start(); drift.start();
    return () => { r1.stop(); r2.stop(); drift.stop(); };
  }, [ring1, ring2, driftAnim]);

  const ringStyle = (val: Animated.Value) => ({
    position: 'absolute' as const,
    width: 168, height: 168, borderRadius: 84,
    borderWidth: 1, borderColor: 'rgba(125,249,255,0.25)',
    opacity: val.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
  });

  const driftScale = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  return (
    <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
      {/* Ambient glow blob */}
      <Animated.View style={{
        position: 'absolute', width: 260, height: 130, borderRadius: 130,
        backgroundColor: 'rgba(125,249,255,0.06)',
        transform: [{ scale: driftScale }],
      }} />

      {/* Pulse rings */}
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />

      {/* Mic button */}
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          width: 96, height: 96, borderRadius: 48,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#7df9ff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.75,
          shadowRadius: 16,
          elevation: 20,
          zIndex: 2,
        }}
      >
        <Mic size={36} color="#fff" />
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
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(6,16,15,0.82)' }}>
        {/* Close button */}
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity testID="voice-close-button" onPress={onClose} activeOpacity={0.7}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#152a2a',
              alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#e0ffff" />
          </TouchableOpacity>
        </View>

        {/* Centered content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <MicOrb />

          {/* Transcript + cursor */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 32, minHeight: 36 }}>
            {interimTranscript ? (
              <>
                <Text style={{ fontSize: 24, fontWeight: '600', color: '#e0ffff',
                  textAlign: 'center', letterSpacing: -0.24, lineHeight: 31 }}>
                  {interimTranscript}
                </Text>
                <BlinkCursor />
              </>
            ) : null}
          </View>

          {/* Hint row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: interimTranscript ? 8 : 20 }}>
            <PulseDot />
            <Text style={{ fontSize: 13, color: '#7aa8a8' }}>
              {interimTranscript ? t('voice.recognizing') : t('voice.hint')}
            </Text>
          </View>

          {/* Suggestion chips */}
          {suggestions.length > 0 && !interimTranscript && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8,
              justifyContent: 'center', marginTop: 28 }}>
              {suggestions.map((s) => (
                <View key={s} style={{ backgroundColor: '#0e1c1c', borderRadius: 999,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1, borderColor: '#1f3a3a' }}>
                  <Text style={{ fontSize: 11, color: '#7aa8a8' }}>"{s}"</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

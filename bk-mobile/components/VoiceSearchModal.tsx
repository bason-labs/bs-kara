import { useEffect, useRef } from 'react';
import { Animated, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mic, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceSearchModalProps {
  visible: boolean;
  interimTranscript: string;
  onClose: () => void;
}

function PulsingRings() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeAnim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(val, { toValue: 1, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a1 = makeAnim(ring1, 0);
    const a2 = makeAnim(ring2, 300);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [ring1, ring2]);

  const ringStyle = (val: Animated.Value, size: number) => ({
    position: 'absolute' as const,
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: 'rgba(0,139,139,0.2)',
    opacity: val.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.8, 0, 0] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.3] }) }],
  });

  return (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle(ring1, 96)} />
      <Animated.View style={ringStyle(ring2, 72)} />
      <LinearGradient colors={['#008b8b', '#0d98ba']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <Mic size={24} color="#fff" />
      </LinearGradient>
    </View>
  );
}

export function VoiceSearchModal({ visible, interimTranscript, onClose }: VoiceSearchModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity testID="voice-close-button" onPress={onClose} activeOpacity={0.7}
          style={{ position: 'absolute', top: 48, right: 16, width: 36, height: 36,
            borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color="#e0ffff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 32, paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 18, color: '#e0ffff', fontWeight: '500',
            lineHeight: 26, minHeight: 28, textAlign: 'center' }}>
            {interimTranscript}
          </Text>
          <Text style={{ fontSize: 12, color: '#7aa8a8', marginTop: 6, textAlign: 'center' }}>
            {t('voice.recognizing')}
          </Text>
        </View>

        <PulsingRings />

        <Text style={{ marginTop: 28, fontSize: 13, color: '#7aa8a8', textAlign: 'center' }}>
          {t('voice.listening')}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 11, color: '#4a7a7a', textAlign: 'center' }}>
          {t('voice.hint')}
        </Text>
      </View>
    </Modal>
  );
}

import { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Check, List, Plus, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { YouTubeVideo } from '@bs-kara/shared';
import { EQBars } from './EQBars';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
  queued?: boolean;
  queuePosition?: number;
  isCurrentlyPlaying?: boolean;
  isJustAdded?: boolean;
}

export function SongResultItem({
  video, onAdd, added, queued, queuePosition, isCurrentlyPlaying, isJustAdded,
}: SongResultItemProps) {
  const { t } = useTranslation();

  // Just-added border glow (fades over 1600ms)
  const glowAnim = useSharedValue(0);
  useEffect(() => {
    if (isJustAdded) {
      glowAnim.value = 1;
      glowAnim.value = withTiming(0, { duration: 1600 });
    } else {
      glowAnim.value = 0;
    }
  }, [isJustAdded, glowAnim]);

  const animBorderStyle = useAnimatedStyle(() => {
    if (isCurrentlyPlaying) return { borderColor: 'rgba(125,249,255,0.55)' };
    if (glowAnim.value > 0) {
      return { borderColor: `rgba(64,224,208,${0.35 + glowAnim.value * 0.35})` };
    }
    if (queued) return { borderColor: 'rgba(64,224,208,0.35)' };
    return { borderColor: '#1f3a3a' };
  });

  // Status pill below channel — one at a time
  let statusPill: React.ReactNode = null;
  if (isCurrentlyPlaying) {
    statusPill = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
        backgroundColor: 'rgba(125,249,255,0.18)', alignSelf: 'flex-start', marginTop: 4 }}>
        <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: '#7df9ff' }} />
        <Text style={{ color: '#7df9ff', fontSize: 11 }}>{t('search.statusNowPlaying')}</Text>
      </View>
    );
  } else if (isJustAdded) {
    statusPill = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
        backgroundColor: 'rgba(64,224,208,0.18)', alignSelf: 'flex-start', marginTop: 4 }}>
        <Sparkles size={11} color="#40e0d0" />
        <Text style={{ color: '#40e0d0', fontSize: 11 }}>{t('search.statusJustAdded')}</Text>
      </View>
    );
  } else if (queued) {
    statusPill = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
        backgroundColor: 'rgba(64,224,208,0.15)', alignSelf: 'flex-start', marginTop: 4 }}>
        <List size={11} color="#40e0d0" />
        <Text style={{ color: '#40e0d0', fontSize: 11 }}>
          {t('search.statusQueued', { pos: queuePosition ?? '' })}
        </Text>
      </View>
    );
  }

  // Action button — 44×44 icon-only
  function renderAction() {
    if (isCurrentlyPlaying) {
      return (
        <View testID="action-playing" style={{ width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(125,249,255,0.4)' }}>
          <Check size={20} color="#7df9ff" />
        </View>
      );
    }
    if (queued || added) {
      return (
        <View testID="action-queued" style={{ width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#152a2a', borderWidth: 1, borderColor: 'rgba(64,224,208,0.3)' }}>
          <Check size={20} color="#40e0d0" />
        </View>
      );
    }
    return (
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 44, height: 44, borderRadius: 22 }}
      >
        <TouchableOpacity testID="add-button" onPress={onAdd} activeOpacity={0.8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const cardBg = isCurrentlyPlaying ? 'rgba(125,249,255,0.04)' : '#0e1c1c';

  return (
    <Animated.View style={[
      { flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 12, marginVertical: 4, padding: 12,
        borderRadius: 14, borderWidth: 1, backgroundColor: cardBg },
      animBorderStyle,
    ]}>
      {/* Thumbnail — 110×62 with overlays */}
      <View style={{ width: 110, height: 62, borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#152a2a', flexShrink: 0 }}>
        <Image source={{ uri: video.thumbnail }}
          style={{ width: 110, height: 62 }} resizeMode="cover" />
        {/* Duration badge */}
        {video.duration ? (
          <View style={{ position: 'absolute', bottom: 4, right: 4,
            backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4,
            paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text testID="duration-badge" style={{ color: '#fff', fontSize: 11, fontWeight: '600',
              fontVariant: ['tabular-nums'] }}>
              {video.duration}
            </Text>
          </View>
        ) : null}
        {/* EQ overlay when now playing */}
        {isCurrentlyPlaying && (
          <View style={{ position: 'absolute', bottom: 6, left: 6,
            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: 3 }}>
            <EQBars color="#7df9ff" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#e0ffff', fontSize: 14.5, fontWeight: '500', lineHeight: 20 }}
          numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={{ color: '#7aa8a8', fontSize: 11.5 }} numberOfLines={1}>
          {video.channel}
        </Text>
        {statusPill}
      </View>

      {/* Action */}
      {renderAction()}
    </Animated.View>
  );
}

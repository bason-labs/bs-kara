import { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Play, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { YouTubeVideo } from '@bs-kara/shared';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
  queued?: boolean;
  isCurrentlyPlaying?: boolean;
  isJustAdded?: boolean;
  onPlayNow?: () => void;
}

export function SongResultItem({
  video, onAdd, added, queued, isCurrentlyPlaying, isJustAdded, onPlayNow,
}: SongResultItemProps) {
  const { t } = useTranslation();

  const glowOpacity = useSharedValue(isJustAdded ? 1 : 0);
  useEffect(() => {
    glowOpacity.value = isJustAdded ? withTiming(0, { duration: 1600 }) : 0;
  }, [isJustAdded, glowOpacity]);
  const glowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(125,249,255,${glowOpacity.value})`,
  }));

  // Priority order: playing > queued > added > default
  const buttonState = isCurrentlyPlaying ? 'playing'
    : queued ? 'queued'
    : added ? 'added'
    : 'default';

  const showPlayNow = !!onPlayNow && !isCurrentlyPlaying;

  function renderAddButton() {
    if (isJustAdded) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
          borderWidth: 1, borderColor: '#7df9ff', borderRadius: 999,
          paddingHorizontal: 10, paddingVertical: 6 }}>
          <Sparkles size={11} color="#7df9ff" />
          <Text style={{ color: '#7df9ff', fontSize: 12, fontWeight: '600' }}>
            {t('search.statusJustAdded')}
          </Text>
        </View>
      );
    }
    if (buttonState === 'playing') {
      return (
        <View testID="add-button"
          style={{ borderWidth: 1, borderColor: '#008b8b', borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#008b8b', fontSize: 12, fontWeight: '600' }}>
            {t('search.nowPlayingLabel')}
          </Text>
        </View>
      );
    }
    if (buttonState === 'queued') {
      return (
        <View testID="add-button"
          style={{ borderWidth: 1, borderColor: '#4a7a7a', borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#4a7a7a', fontSize: 12, fontWeight: '600' }}>
            {t('search.inQueue')}
          </Text>
        </View>
      );
    }
    if (buttonState === 'added') {
      return (
        <TouchableOpacity testID="add-button" disabled activeOpacity={1}
          style={{ borderWidth: 1, borderColor: '#008b8b', borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 6, opacity: 0.7 }}>
          <Text style={{ color: '#008b8b', fontSize: 12, fontWeight: '600' }}>
            {t('search.addedToQueueButton')}
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 999 }}
      >
        <TouchableOpacity testID="add-button" onPress={onAdd} activeOpacity={0.8}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>+ Thêm</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <Animated.View style={[
      { flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#1f3a3a',
        borderWidth: 1, borderRadius: 8 },
      glowStyle,
    ]}>
      <Image source={{ uri: video.thumbnail }}
        style={{ width: 72, height: 44, borderRadius: 6, backgroundColor: '#152a2a' }}
        resizeMode="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: isCurrentlyPlaying ? '#008b8b' : '#e0ffff',
          fontSize: 13, fontWeight: '500' }} numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={{ color: '#7aa8a8', fontSize: 11 }}>{video.channel}</Text>
        {video.duration ? (
          <Text style={{ color: '#4a7a7a', fontSize: 11 }}>{video.duration}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showPlayNow && (
          <TouchableOpacity testID="play-now-button" onPress={onPlayNow} activeOpacity={0.7}
            style={{ width: 32, height: 32, borderRadius: 16,
              borderWidth: 1, borderColor: '#1f3a3a',
              alignItems: 'center', justifyContent: 'center' }}>
            <Play size={14} color="#7aa8a8" fill="#7aa8a8" />
          </TouchableOpacity>
        )}
        {renderAddButton()}
      </View>
    </Animated.View>
  );
}

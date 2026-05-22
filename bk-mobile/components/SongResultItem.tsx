import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { YouTubeVideo } from '@bs-kara/shared';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
  queued?: boolean;
  isCurrentlyPlaying?: boolean;
  onPlayNow?: () => void;
}

export function SongResultItem({
  video, onAdd, added, queued, isCurrentlyPlaying, onPlayNow,
}: SongResultItemProps) {
  const { t } = useTranslation();

  // Priority order: playing > queued > added > default
  const buttonState = isCurrentlyPlaying ? 'playing'
    : queued ? 'queued'
    : added ? 'added'
    : 'default';

  const showPlayNow = !!onPlayNow && !isCurrentlyPlaying;

  function renderAddButton() {
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
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
    </View>
  );
}

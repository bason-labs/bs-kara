import { View, Text, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Mic, Play, Pause, Maximize2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { YouTubeVideo } from '@bs-kara/shared';
import { useColors } from '@/hooks/useColors';

interface NowPlayingCardProps {
  song: YouTubeVideo | null;
  isPlaying: boolean;
  onToggle: () => void;
  variant?: 'compact' | 'hero';
  onExpand?: () => void;
  isTvActive?: boolean;
  onSkip?: () => void;
}

export function NowPlayingCard({
  song,
  isPlaying,
  onToggle,
  variant = 'compact',
  onExpand,
  isTvActive = false,
  onSkip,
}: NowPlayingCardProps) {
  const { t } = useTranslation();
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = (windowWidth - 48) * (9 / 16);

  if (!song) return null;

  if (variant === 'hero') {
    return (
      <View testID="now-playing-card-hero" style={{ paddingHorizontal: 24, gap: 12 }}>
        {/* Full-width 16:9 thumbnail */}
        <View style={{ borderRadius: 16, overflow: 'hidden', height: heroHeight }}>
          <Image
            source={{ uri: song.thumbnail }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {/* "ĐANG PHÁT" overlay — bottom-left */}
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
            <Text
              style={{
                color: c.accent,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {t('nowPlaying.label')}
            </Text>
          </View>
          {/* Expand button — top-right, hidden when isTvActive */}
          {onExpand && !isTvActive && (
            <TouchableOpacity
              testID="expand-button"
              onPress={onExpand}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mở toàn màn hình"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(0,0,0,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Maximize2 size={18} color={c.fg} />
            </TouchableOpacity>
          )}
        </View>
        {/* Song info */}
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.fg, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>
            {song.title}
          </Text>
          {song.channel ? (
            <Text style={{ color: c.muted, fontSize: 12 }}>{song.channel}</Text>
          ) : null}
          {song.requesterName ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(0,139,139,0.15)',
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                marginTop: 2,
              }}
            >
              <Mic size={11} color={c.accent} />
              <Text style={{ color: c.accent, fontSize: 11 }}>{song.requesterName}</Text>
            </View>
          ) : null}
        </View>
        {/* Skip current */}
        {onSkip && (
          <TouchableOpacity onPress={onSkip} activeOpacity={0.7} accessibilityRole="button">
            <Text style={{ color: c.muted, fontSize: 12 }}>{t('nowPlaying.removeAriaLabel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Compact variant (default)
  return (
    <View
      testID="now-playing-card"
      className="flex-row items-center gap-3 mx-4 mb-3 p-3 rounded-2xl"
      style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.brand }}
    >
      <Mic size={16} color={c.brand} />
      <Image
        source={{ uri: song.thumbnail }}
        className="w-12 h-9 rounded-lg"
        style={{ backgroundColor: c.surface2 }}
        resizeMode="cover"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold" style={{ color: c.fg }} numberOfLines={1}>
          {song.title}
        </Text>
        {song.requesterName ? (
          <Text className="text-xs" style={{ color: c.muted }}>{song.requesterName}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ padding: 8 }}
      >
        {isPlaying ? <Pause size={20} color={c.accent} /> : <Play size={20} color={c.accent} />}
      </TouchableOpacity>
    </View>
  );
}

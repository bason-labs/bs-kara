import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { YouTubeVideo } from '@bs-kara/shared';
import { EQBars } from './EQBars';
import { useColors } from '@/hooks/useColors';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
  queued?: boolean;
  isCurrentlyPlaying?: boolean;
}

export function SongResultItem({
  video, onAdd, added, queued, isCurrentlyPlaying,
}: SongResultItemProps) {
  const { t } = useTranslation();
  const c = useColors();

  const borderColor = isCurrentlyPlaying
    ? 'rgba(125,249,255,0.55)'
    : queued
      ? 'rgba(64,224,208,0.35)'
      : c.border;

  const statusPill: React.ReactNode = isCurrentlyPlaying ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
      backgroundColor: 'rgba(125,249,255,0.18)', alignSelf: 'flex-start', marginTop: 4 }}>
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: c.glow }} />
      <Text style={{ color: c.glow, fontSize: 11 }}>{t('search.statusNowPlaying')}</Text>
    </View>
  ) : null;

  // Action button — 44×44 icon-only
  function renderAction() {
    if (isCurrentlyPlaying) {
      return (
        <View testID="action-playing" style={{ width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(125,249,255,0.4)' }}>
          <Check size={20} color={c.glow} />
        </View>
      );
    }
    if (queued || added) {
      return (
        <View testID="action-queued" style={{ width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: c.surface2, borderWidth: 1, borderColor: 'rgba(64,224,208,0.3)' }}>
          <Check size={20} color={c.accent} />
        </View>
      );
    }
    return (
      <LinearGradient
        colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
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

  const cardBg = isCurrentlyPlaying ? 'rgba(125,249,255,0.04)' : c.surface;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 12, marginVertical: 4, padding: 12,
      borderRadius: 14, borderWidth: 1, backgroundColor: cardBg, borderColor,
    }}>
      {/* Thumbnail — 110×62 with overlays */}
      <View style={{ width: 110, height: 62, borderRadius: 8, overflow: 'hidden',
        backgroundColor: c.surface2, flexShrink: 0 }}>
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
            <EQBars color={c.glow} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.fg, fontSize: 14.5, fontWeight: '500', lineHeight: 20 }}
          numberOfLines={2}>
          {video.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11.5 }} numberOfLines={1}>
          {video.channel}
        </Text>
        {statusPill}
      </View>

      {/* Action */}
      {renderAction()}
    </View>
  );
}

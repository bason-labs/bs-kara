import { View, Text, Image, TouchableOpacity } from 'react-native';
import { GripVertical, Mic, Trash2 } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';
import { PlayNowButton } from './PlayNowButton';
import { useColors } from '@/hooks/useColors';

interface QueueItemRowProps {
  item: QueueItem;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
  onEditRequester?: () => void;
  currentUserName?: string;
  isHost?: boolean;
  currentPlayingId?: string | null;
  onPlayNow?: () => void;
}

export function QueueItemRow({
  item,
  onRemove,
  drag,
  dragEnabled = true,
  onEditRequester,
  currentUserName,
  isHost = false,
  currentPlayingId,
  onPlayNow,
}: QueueItemRowProps) {
  const c = useColors();
  const isMyRow = currentUserName && item.requesterName === currentUserName;

  const cardBg = isMyRow ? 'rgba(64,224,208,0.06)' : c.surface;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginVertical: 4,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: cardBg,
    }}>
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} style={{ padding: 4 }}>
          <GripVertical size={18} color={c.muted} />
        </TouchableOpacity>
      )}

      {/* Thumbnail — 110×62 to mirror SongResultItem */}
      <View style={{ width: 110, height: 62, borderRadius: 8, overflow: 'hidden',
        backgroundColor: c.surface2, flexShrink: 0 }}>
        <Image
          source={{ uri: item.thumbnail }}
          style={{ width: 110, height: 62 }}
          resizeMode="cover"
        />
      </View>

      {/* Content — title + channel (no position, no ETA) */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: c.fg, fontSize: 14.5, fontWeight: '500', lineHeight: 20 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11.5 }} numberOfLines={1}>
          {item.channel}
        </Text>
        {item.requesterName ? (
          <TouchableOpacity
            onPress={onEditRequester}
            disabled={!onEditRequester}
            activeOpacity={onEditRequester ? 0.7 : 1}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              backgroundColor: 'rgba(0,139,139,0.15)', borderRadius: 999,
              paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
            }}
          >
            <Mic size={10} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 10 }}>{item.requesterName}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {onPlayNow && (
        <PlayNowButton
          videoId={item.id}
          currentPlayingId={currentPlayingId}
          onPress={onPlayNow}
          isHost={isHost}
        />
      )}

      <TouchableOpacity
        testID="remove-button"
        onPress={onRemove}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 8, flexShrink: 0 }}
      >
        <Trash2 size={18} color={c.muted} />
      </TouchableOpacity>
    </View>
  );
}

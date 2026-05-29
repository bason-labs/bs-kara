import { View, Text, Image, TouchableOpacity } from 'react-native';
import { GripVertical, Mic, Trash2 } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
  onEditRequester?: () => void;
  currentUserName?: string;
}

export function QueueItemRow({
  item,
  onRemove,
  drag,
  dragEnabled = true,
  onEditRequester,
  currentUserName,
}: QueueItemRowProps) {
  const isMyRow = currentUserName && item.requesterName === currentUserName;

  const cardBg = isMyRow ? 'rgba(64,224,208,0.06)' : '#0e1c1c';

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
      borderColor: '#1f3a3a',
      backgroundColor: cardBg,
    }}>
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} style={{ padding: 4 }}>
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}

      {/* Thumbnail — 110×62 to mirror SongResultItem */}
      <View style={{ width: 110, height: 62, borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#152a2a', flexShrink: 0 }}>
        <Image
          source={{ uri: item.thumbnail }}
          style={{ width: 110, height: 62 }}
          resizeMode="cover"
        />
      </View>

      {/* Content — title + channel (no position, no ETA) */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: '#e0ffff', fontSize: 14.5, fontWeight: '500', lineHeight: 20 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={{ color: '#7aa8a8', fontSize: 11.5 }} numberOfLines={1}>
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
            <Mic size={10} color="#40e0d0" />
            <Text style={{ color: '#40e0d0', fontSize: 10 }}>{item.requesterName}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        testID="remove-button"
        onPress={onRemove}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 8, flexShrink: 0 }}
      >
        <Trash2 size={18} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}

import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GripVertical, Mic, Play, Trash2 } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  queuePosition: number;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
  isHost: boolean;
  guestCanRemove: boolean;
  onPlayNow?: () => void;
  onEditRequester?: () => void;
  currentUserName?: string;
}

export function QueueItemRow({
  item,
  index,
  queuePosition,
  onRemove,
  drag,
  dragEnabled = true,
  isHost,
  guestCanRemove,
  onPlayNow,
  onEditRequester,
  currentUserName,
}: QueueItemRowProps) {
  const { t } = useTranslation();
  const canRemove = isHost || guestCanRemove;
  const eta = queuePosition * 4;
  const isMyRow = currentUserName && item.requesterName === currentUserName;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1f3a3a',
        backgroundColor: isMyRow ? 'rgba(64,224,208,0.06)' : '#06100f',
      }}
    >
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} style={{ padding: 4 }}>
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}

      <Image
        source={{ uri: item.thumbnail }}
        style={{ width: 56, height: 36, borderRadius: 6, backgroundColor: '#152a2a' }}
        resizeMode="cover"
      />

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: '#e0ffff', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ color: '#7aa8a8', fontSize: 11 }}>
          {t('queue.eta', '#{{n}} · ~{{eta}} phút', { n: queuePosition, eta })}
        </Text>
        {item.requesterName ? (
          <TouchableOpacity
            onPress={onEditRequester}
            disabled={!onEditRequester}
            activeOpacity={onEditRequester ? 0.7 : 1}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(0,139,139,0.15)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Mic size={10} color="#40e0d0" />
            <Text style={{ color: '#40e0d0', fontSize: 10 }}>{item.requesterName}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isHost && onPlayNow && (
        <TouchableOpacity
          testID="play-now-button"
          onPress={onPlayNow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#1f3a3a', alignItems: 'center', justifyContent: 'center' }}
        >
          <Play size={16} color="#40e0d0" fill="#40e0d0" />
        </TouchableOpacity>
      )}

      {canRemove && (
        <TouchableOpacity
          testID="remove-button"
          onPress={onRemove}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 8 }}
        >
          <Trash2 size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

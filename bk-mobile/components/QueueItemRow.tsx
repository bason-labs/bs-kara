import { View, Text, Image, TouchableOpacity } from 'react-native';
import { GripVertical, Trash2, Mic } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
}

export function QueueItemRow({ item, index, onRemove, drag, dragEnabled = true }: QueueItemRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-[#1f3a3a] bg-[#06100f]">
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} className="p-1">
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}

      {/* Item number */}
      <Text className="text-[#7aa8a8] text-xs font-semibold w-5 text-center tabular-nums">
        {index + 1}
      </Text>

      {/* Thumbnail */}
      <Image
        source={{ uri: item.thumbnail }}
        className="w-16 h-12 rounded-lg bg-[#152a2a]"
        resizeMode="cover"
      />

      {/* Text block */}
      <View className="flex-1 gap-1">
        <Text className="text-[#e0ffff] text-sm" numberOfLines={2}>{item.title}</Text>
        {item.requesterName ? (
          <View className="flex-row items-center gap-1 self-start bg-[#008b8b26] rounded-full px-2 py-0.5">
            <Mic size={11} color="#40e0d0" />
            <Text className="text-[#40e0d0] text-xs">{item.requesterName}</Text>
          </View>
        ) : null}
      </View>

      {/* Remove */}
      <TouchableOpacity testID="remove-button" onPress={onRemove} activeOpacity={0.7} className="p-2">
        <Trash2 size={18} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}

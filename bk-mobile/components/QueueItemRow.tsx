import { View, Text, Image, TouchableOpacity } from 'react-native';
import { GripVertical, X } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
}

export function QueueItemRow({ item, onRemove, drag, dragEnabled = true }: QueueItemRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-[#1f3a3a] bg-[#06100f]">
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} className="p-1">
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}
      <Image
        source={{ uri: item.thumbnail }}
        className="w-12 h-9 rounded-lg bg-[#152a2a]"
        resizeMode="cover"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-[#e0ffff] text-sm" numberOfLines={2}>{item.title}</Text>
        {item.requesterName ? (
          <Text className="text-[#7aa8a8] text-xs">{item.requesterName}</Text>
        ) : null}
      </View>
      <TouchableOpacity testID="remove-button" onPress={onRemove} activeOpacity={0.7} className="p-2">
        <X size={18} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}

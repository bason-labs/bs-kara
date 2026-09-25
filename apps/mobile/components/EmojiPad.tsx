import { View, TouchableOpacity, Text } from 'react-native';
import { REACTIONS } from '@bs-kara/shared';
import { useColors } from '@/hooks/useColors';

interface EmojiPadProps {
  onSend: (emoji: string) => void;
}

export function EmojiPad({ onSend }: EmojiPadProps) {
  const c = useColors();
  return (
    <View className="flex-row justify-around px-4 py-3 border-t" style={{ borderTopColor: c.border, backgroundColor: c.surface }}>
      {REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          accessibilityRole="button"
          onPress={() => onSend(emoji)}
          activeOpacity={0.6}
          className="p-2 rounded-full"
        >
          <Text className="text-2xl">{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

import { View, TouchableOpacity, Text } from 'react-native';
import { REACTIONS } from '@bs-kara/shared';

interface EmojiPadProps {
  onSend: (emoji: string) => void;
}

export function EmojiPad({ onSend }: EmojiPadProps) {
  return (
    <View className="flex-row justify-around px-4 py-3 border-t border-[#1f3a3a] bg-[#0e1c1c]">
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

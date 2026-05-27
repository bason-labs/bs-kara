import { TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function GradientButton({ label, onPress, disabled }: GradientButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      className="w-full rounded-full overflow-hidden"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="py-4 items-center"
      >
        <Text className="text-[#e0ffff] font-semibold text-base">{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

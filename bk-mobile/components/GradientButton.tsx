import { TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function GradientButton({ label, onPress, disabled }: GradientButtonProps) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      className="w-full rounded-full overflow-hidden"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="py-4 items-center"
      >
        <Text className="font-semibold text-base" style={{ color: c.fg }}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

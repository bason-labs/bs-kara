import { TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface OTPInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  ariaLabel?: string;
}

export function OTPInput({ value, onChange, onComplete, ariaLabel }: OTPInputProps) {
  const c = useColors();

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 7);
    onChange(digits);
    if (digits.length >= 4) onComplete(digits);
  }

  return (
    <View className="w-full">
      <TextInput
        testID="otp-input"
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={7}
        placeholder="0000"
        placeholderTextColor={c.muted}
        accessibilityLabel={ariaLabel}
        className="w-full text-center text-4xl font-bold rounded-2xl py-5 px-4"
        style={{ letterSpacing: 16, color: c.fg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
      />
    </View>
  );
}

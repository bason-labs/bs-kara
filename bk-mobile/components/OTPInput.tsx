import { TextInput, View } from 'react-native';

interface OTPInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  ariaLabel?: string;
}

export function OTPInput({ value, onChange, onComplete, ariaLabel }: OTPInputProps) {
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
        placeholderTextColor="#7aa8a8"
        accessibilityLabel={ariaLabel}
        className="w-full text-center text-4xl font-bold text-[#e0ffff] bg-[#0e1c1c] border border-[#1f3a3a] rounded-2xl py-5 px-4"
        style={{ letterSpacing: 16 }}
      />
    </View>
  );
}

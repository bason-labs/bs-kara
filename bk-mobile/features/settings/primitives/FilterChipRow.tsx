import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function FilterChipRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.4 : 1 }}>
      <Text
        style={{
          color: c.muted,
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          if (active) {
            return (
              <LinearGradient
                key={opt.value}
                colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 999 }}
              >
                <TouchableOpacity
                  disabled={disabled}
                  onPress={() => onChange(opt.value)}
                  activeOpacity={0.8}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            );
          }
          return (
            <TouchableOpacity
              key={opt.value}
              disabled={disabled}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
              style={{
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

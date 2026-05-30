import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function SectionLabel({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      {Icon && <Icon size={11} color={c.muted} strokeWidth={2.4} />}
      <Text
        style={{
          color: c.muted,
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

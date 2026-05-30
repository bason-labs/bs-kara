import { Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function SectionLabel({ label }: { label: string }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <Text
      style={{
        color: c.muted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 2,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      {label}
    </Text>
  );
}

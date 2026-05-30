import { View, Text, Switch } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  testID,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
  icon?: LucideIcon;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 4,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={14} color={c.muted} strokeWidth={2.2} />}
          <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>{label}</Text>
        </View>
        {hint ? (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.brand }}
        thumbColor="#fff"
      />
    </View>
  );
}

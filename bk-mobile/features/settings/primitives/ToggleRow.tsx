import { View, Text, Switch } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: c.fg, fontSize: 14 }}>{label}</Text>
        {hint ? (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.brand }}
        thumbColor={c.fg}
      />
    </View>
  );
}

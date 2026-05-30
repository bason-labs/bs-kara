// bk-mobile/components/ThemeToggle.tsx
import { TouchableOpacity } from 'react-native';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import type { Theme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

const NEXT_PREF: Record<Theme, Theme> = { dark: 'light', light: 'system', system: 'dark' };

export function ThemeToggle() {
  const { preference, setPreference, resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  return (
    <TouchableOpacity
      onPress={() => setPreference(NEXT_PREF[preference])}
      activeOpacity={0.7}
      className="p-2"
    >
      <Icon size={20} color={c.muted} />
    </TouchableOpacity>
  );
}

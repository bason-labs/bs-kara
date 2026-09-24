import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function useColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? DarkColors : LightColors;
}

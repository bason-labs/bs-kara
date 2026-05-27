import { TouchableOpacity } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.7} className="p-2">
      <Icon size={20} color="#7aa8a8" />
    </TouchableOpacity>
  );
}

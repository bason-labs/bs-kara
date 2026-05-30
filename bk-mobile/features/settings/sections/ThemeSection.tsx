import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, Monitor, Moon, Palette } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';
import type { Theme } from '@/context/ThemeContext';

const THEME_OPTIONS: { value: Theme; Icon: LucideIcon }[] = [
  { value: 'light', Icon: Sun },
  { value: 'system', Icon: Monitor },
  { value: 'dark', Icon: Moon },
];

export function ThemeSection() {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.appearance')} icon={Palette} />
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
          <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>
            {t('settings.themeLabel')}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
            {t('settings.themeHint')}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderRadius: 20,
            padding: 3,
            gap: 2,
          }}
        >
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            if (active) {
              return (
                <LinearGradient
                  key={opt.value}
                  colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 30, height: 30, borderRadius: 16 }}
                >
                  <TouchableOpacity
                    onPress={() => setPreference(opt.value)}
                    activeOpacity={0.8}
                    style={{
                      width: 30,
                      height: 30,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <opt.Icon size={15} color="#fff" strokeWidth={2.2} />
                  </TouchableOpacity>
                </LinearGradient>
              );
            }
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                activeOpacity={0.7}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <opt.Icon size={15} color={c.muted} strokeWidth={2.2} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

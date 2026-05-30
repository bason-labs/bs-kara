import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';

interface RoomSectionProps {
  roomCode: string;
}

export function RoomSection({ roomCode }: RoomSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.room')} />
      <View
        style={{
          marginHorizontal: 12,
          marginBottom: 4,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: c.muted,
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {t('settings.roomCodeLabel')}
        </Text>
        <LinearGradient
          colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 4 }}>
            {roomCode}
          </Text>
        </LinearGradient>
      </View>
    </>
  );
}

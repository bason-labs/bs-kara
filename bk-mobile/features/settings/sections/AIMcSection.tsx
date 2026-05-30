import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Sparkles, Trophy } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';
import { ToggleRow } from '../primitives/ToggleRow';

const MC_VOICE_OPTIONS = [
  { value: 'vi-VN-Neural2-A', labelKey: 'settings.mcVoiceOptions.neural2A' },
  { value: 'vi-VN-Wavenet-C', labelKey: 'settings.mcVoiceOptions.wavenetC' },
  { value: 'vi-VN-Neural2-D', labelKey: 'settings.mcVoiceOptions.neural2D' },
  { value: 'vi-VN-Wavenet-B', labelKey: 'settings.mcVoiceOptions.wavenetB' },
];

interface AIMcSectionProps {
  isMCEnabled: boolean;
  aiScoringEnabled: boolean;
  mcVoice: string;
  onMCEnabledChange: (v: boolean) => void;
  onAiScoringChange: (v: boolean) => void;
  onMcVoiceChange: (v: string) => void;
}

export function AIMcSection({
  isMCEnabled,
  aiScoringEnabled,
  mcVoice,
  onMCEnabledChange,
  onAiScoringChange,
  onMcVoiceChange,
}: AIMcSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.aiMc')} icon={Sparkles} />
      <ToggleRow
        icon={Sparkles}
        label={t('settings.aiMcLabel')}
        hint={t('settings.aiMcHint')}
        value={isMCEnabled}
        onValueChange={onMCEnabledChange}
      />
      <ToggleRow
        icon={Trophy}
        label={t('scoring.toggleLabel')}
        hint={t('scoring.toggleHelp')}
        value={aiScoringEnabled}
        onValueChange={onAiScoringChange}
      />
      {isMCEnabled && (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 4,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            padding: 16,
          }}
        >
            <Text
              style={{
                color: c.muted,
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              {t('settings.mcVoiceLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MC_VOICE_OPTIONS.map((opt) => {
                const active = mcVoice === opt.value;
                if (active) {
                  return (
                    <LinearGradient
                      key={opt.value}
                      colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: 12, flex: 1, minWidth: '45%' }}
                    >
                      <TouchableOpacity
                        onPress={() => onMcVoiceChange(opt.value)}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>
                          {t(opt.labelKey)}
                        </Text>
                        <Check size={14} color="#fff" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </LinearGradient>
                  );
                }
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onMcVoiceChange(opt.value)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: '45%',
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: c.muted, fontSize: 13 }}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
    </>
  );
}

import { View, Text, Switch, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomContext } from '@/context/RoomContext';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

const MC_VOICE_OPTIONS = [
  { value: 'vi-VN-Neural2-A', labelKey: 'settings.mcVoiceOptions.neural2A' },
  { value: 'vi-VN-Wavenet-C', labelKey: 'settings.mcVoiceOptions.wavenetC' },
  { value: 'vi-VN-Neural2-D', labelKey: 'settings.mcVoiceOptions.neural2D' },
  { value: 'vi-VN-Wavenet-B', labelKey: 'settings.mcVoiceOptions.wavenetB' },
];

const TYPE_OPTIONS: { value: SingerType; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.type.all' },
  { value: 'solo', labelKey: 'autoRandom.type.solo' },
  { value: 'duet', labelKey: 'autoRandom.type.duet' },
];
const TONE_OPTIONS: { value: Tone; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.tone.all' },
  { value: 'male', labelKey: 'autoRandom.tone.male' },
  { value: 'female', labelKey: 'autoRandom.tone.female' },
];
const GENRE_OPTIONS: { value: Genre; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.genre.all' },
  { value: 'bolero', labelKey: 'autoRandom.genre.bolero' },
  { value: 'caco', labelKey: 'autoRandom.genre.caco' },
  { value: 'tre', labelKey: 'autoRandom.genre.tre' },
];

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: '#7aa8a8', fontSize: 10, fontWeight: '600',
      textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
      {label}
    </Text>
  );
}

function ToggleRow({ label, hint, value, onValueChange, testID }: {
  label: string; hint?: string; value: boolean;
  onValueChange: (v: boolean) => void; testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: '#e0ffff', fontSize: 14 }}>{label}</Text>
        {hint ? <Text style={{ color: '#7aa8a8', fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onValueChange}
        trackColor={{ false: '#1f3a3a', true: '#008b8b' }} thumbColor="#e0ffff" />
    </View>
  );
}

function FilterChipRow({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: '#7aa8a8', fontSize: 11, fontWeight: '600',
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          if (active) {
            return (
              <LinearGradient key={opt.value} colors={['#008b8b', '#006d6f', '#0d98ba']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 999 }}>
                <TouchableOpacity onPress={() => !disabled && onChange(opt.value)} activeOpacity={0.8}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{opt.label}</Text>
                </TouchableOpacity>
              </LinearGradient>
            );
          }
          return (
            <TouchableOpacity key={opt.value} onPress={() => !disabled && onChange(opt.value)} activeOpacity={0.7}
              style={{ backgroundColor: '#152a2a', borderWidth: 1, borderColor: '#1f3a3a',
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#7aa8a8', fontSize: 12 }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    roomData, roomCode,
    setAutoRandomMode, setRandomFilters, setDragDropEnabled,
    setRequesterPromptEnabled, setMCEnabled, setAiScoringEnabled,
    setMcVoice, setGuestCanRemove,
  } = useRoomContext();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
        <Text style={{ color: '#e0ffff', fontSize: 18, fontWeight: '700' }}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

        {/* Auto-random section */}
        <SectionLabel label={t('settings.sections.autoRandom')} />
        <View style={{ backgroundColor: roomData.isAutoRandomMode ? 'rgba(0,139,139,0.08)' : '#152a2a',
          borderWidth: 1, borderColor: roomData.isAutoRandomMode ? 'rgba(0,139,139,0.4)' : '#1f3a3a',
          borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setAutoRandomMode(!roomData.isAutoRandomMode)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#e0ffff', fontSize: 14, fontWeight: '600' }}>{t('autoRandom.toggleLabel')}</Text>
              <Text style={{ color: roomData.isAutoRandomMode ? '#40e0d0' : '#7aa8a8',
                fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 3, marginTop: 4 }}>
                {roomData.isAutoRandomMode ? t('autoRandom.onBadge') : t('autoRandom.offBadge')}
              </Text>
            </View>
            <Switch value={roomData.isAutoRandomMode} onValueChange={setAutoRandomMode}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }} thumbColor="#e0ffff" />
          </TouchableOpacity>

          {roomData.isAutoRandomMode && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8,
              borderTopWidth: 1, borderTopColor: 'rgba(0,139,139,0.2)' }}>
              <Text style={{ color: '#7aa8a8', fontSize: 12, marginBottom: 16 }}>{t('autoRandom.description')}</Text>
              <FilterChipRow label={t('autoRandom.genreLabel')} value={roomData.randomFilters.genre}
                options={GENRE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                onChange={(v) => setRandomFilters({ genre: v as Genre })} />
              <FilterChipRow label={t('autoRandom.typeLabel')} value={roomData.randomFilters.type}
                options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                onChange={(v) => {
                  const next = v as SingerType;
                  if (next === 'duet') setRandomFilters({ type: next, tone: 'all' });
                  else setRandomFilters({ type: next });
                }} />
              <FilterChipRow label={t('autoRandom.toneLabel')} value={roomData.randomFilters.tone}
                options={TONE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                onChange={(v) => setRandomFilters({ tone: v as Tone })}
                disabled={roomData.randomFilters.type === 'duet'} />
            </View>
          )}
        </View>

        {/* Queue section */}
        <SectionLabel label={t('settings.sections.queue')} />
        <View style={{ marginBottom: 20 }}>
          <ToggleRow testID="toggle-drag-drop" label={t('settings.dragDropLabel')} hint={t('settings.dragDropHint')}
            value={roomData.dragDropEnabled} onValueChange={setDragDropEnabled} />
          <ToggleRow label={t('settings.requesterPromptLabel')} hint={t('settings.requesterPromptHint')}
            value={roomData.requesterPromptEnabled} onValueChange={setRequesterPromptEnabled} />
          <ToggleRow label={t('settings.guestCanRemoveLabel')} hint={t('settings.guestCanRemoveHint')}
            value={roomData.guestCanRemove} onValueChange={setGuestCanRemove} />
        </View>

        {/* AI MC section */}
        <SectionLabel label={t('settings.sections.aiMc')} />
        <View style={{ marginBottom: 20 }}>
          <ToggleRow label={t('settings.aiMcLabel')} hint={t('settings.aiMcHint')}
            value={roomData.isMCEnabled} onValueChange={setMCEnabled} />
          <ToggleRow label={t('scoring.toggleLabel')} hint={t('scoring.toggleHelp')}
            value={roomData.aiScoringEnabled} onValueChange={setAiScoringEnabled} />
          {roomData.isMCEnabled && (
            <View style={{ backgroundColor: '#152a2a', borderWidth: 1, borderColor: '#1f3a3a',
              borderRadius: 16, padding: 16, marginTop: 8 }}>
              <Text style={{ color: '#7aa8a8', fontSize: 10, fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                {t('settings.mcVoiceLabel')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MC_VOICE_OPTIONS.map((opt) => {
                  const active = roomData.mcVoice === opt.value;
                  if (active) {
                    return (
                      <LinearGradient key={opt.value} colors={['#008b8b', '#006d6f', '#0d98ba']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 12, flex: 1, minWidth: '45%' }}>
                        <TouchableOpacity onPress={() => setMcVoice(opt.value)} activeOpacity={0.8}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>{t(opt.labelKey)}</Text>
                          <Check size={14} color="#fff" strokeWidth={2.4} />
                        </TouchableOpacity>
                      </LinearGradient>
                    );
                  }
                  return (
                    <TouchableOpacity key={opt.value} onPress={() => setMcVoice(opt.value)} activeOpacity={0.7}
                      style={{ flex: 1, minWidth: '45%', backgroundColor: '#0e1c1c', borderWidth: 1,
                        borderColor: '#1f3a3a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                      <Text style={{ color: '#7aa8a8', fontSize: 13 }}>{t(opt.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Room section */}
        <SectionLabel label={t('settings.sections.room')} />
        <View style={{ backgroundColor: '#152a2a', borderWidth: 1, borderColor: '#1f3a3a',
          borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#7aa8a8', fontSize: 10, fontWeight: '600',
            textTransform: 'uppercase', letterSpacing: 2 }}>
            {t('settings.roomCodeLabel')}
          </Text>
          <LinearGradient colors={['#008b8b', '#006d6f', '#0d98ba']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 4 }}>{roomCode}</Text>
          </LinearGradient>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

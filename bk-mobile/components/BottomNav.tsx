import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ListMusic, Play, Search, Settings } from 'lucide-react-native';
import { useSettingsContext } from '@/context/SettingsContext';

export type NavTab = 'search' | 'queue' | 'player' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  isPlaying: boolean;
  queueLength: number;
  onTabChange: (tab: NavTab) => void;
}

export function BottomNav({ activeTab, isPlaying, queueLength, onTabChange }: BottomNavProps) {
  const { openSettings } = useSettingsContext();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const GLOW = '#7df9ff';
  const MUTED = '#7aa8a8';

  const tabs: { id: NavTab; label: string }[] = [
    { id: 'search', label: t('tabs.search', 'Tìm bài') },
    { id: 'queue',  label: t('tabs.queue',  'Hàng chờ') },
    { id: 'player', label: t('tabs.player', 'Đang phát') },
  ];

  function renderIcon(tab: NavTab, active: boolean) {
    const color = active ? GLOW : MUTED;
    if (tab === 'player') return <Play size={20} color={color} />;
    if (tab === 'search') return <Search size={20} color={color} />;
    return <ListMusic size={20} color={color} />;
  }

  return (
    <View testID="bottom-nav" style={{ flexDirection: 'row', backgroundColor: 'rgba(6,16,15,0.65)', borderTopWidth: 1, borderTopColor: '#1f3a3a', paddingBottom: insets.bottom }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} testID={`tab-${tab.id}`} onPress={() => onTabChange(tab.id)} accessibilityRole="tab" accessibilityState={{ selected: active }}
            style={{ flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4, minHeight: 44 }}>
            <View pointerEvents="none" style={{ width: 56, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(125,249,255,0.2)' : 'transparent' }}>
              {renderIcon(tab.id, active)}
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: '600', marginTop: 2, color: active ? '#e0ffff' : MUTED }}>{tab.label}</Text>
            {tab.id === 'queue' && queueLength > 0 && (
              <View testID="queue-badge" style={{ position: 'absolute', top: 2, right: 10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#40e0d0', borderWidth: 2, borderColor: '#06100f', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#001a1a' }}>{queueLength}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
      <Pressable testID="tab-settings" onPress={openSettings} accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'settings' }} accessibilityLabel={t('tabs.settings', 'Cài đặt')}
        style={{ flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4, minHeight: 44 }}>
        <View pointerEvents="none" style={{ width: 56, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'settings' ? 'rgba(125,249,255,0.2)' : 'transparent' }}>
          <Settings size={20} color={activeTab === 'settings' ? GLOW : MUTED} />
        </View>
        <Text style={{ fontSize: 10.5, fontWeight: '600', marginTop: 2, color: activeTab === 'settings' ? '#e0ffff' : MUTED }}>{t('tabs.settings', 'Cài đặt')}</Text>
      </Pressable>
    </View>
  );
}

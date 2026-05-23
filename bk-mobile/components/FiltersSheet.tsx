import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

export interface FilterOption { id: string; label: string; keyword: string; }
export interface FilterGroup { labelKey: string; options: FilterOption[]; }

export const FILTER_GROUPS: FilterGroup[] = [
  {
    labelKey: 'search.filterGroupHinhThuc',
    options: [
      { id: 'solo',    label: 'Đơn ca',  keyword: 'đơn ca'  },
      { id: 'song-ca', label: 'Song ca', keyword: 'song ca' },
      { id: 'top-ca',  label: 'Tốp ca',  keyword: 'tốp ca'  },
    ],
  },
  {
    labelKey: 'search.filterGroupTongGiong',
    options: [
      { id: 'tone-nam', label: 'Tone nam', keyword: 'tone nam' },
      { id: 'tone-nu',  label: 'Tone nữ',  keyword: 'tone nữ'  },
      { id: 'hon-hop',  label: 'Hỗn hợp', keyword: ''          },
    ],
  },
  {
    labelKey: 'search.filterGroupTheLoai',
    options: [
      { id: 'bolero',   label: 'Bolero',   keyword: 'bolero'   },
      { id: 'ca-co',    label: 'Ca cổ',    keyword: 'ca cổ'    },
      { id: 'nhac-tre', label: 'Nhạc trẻ', keyword: 'nhạc trẻ' },
    ],
  },
];

export const ALL_FILTER_OPTIONS: FilterOption[] = FILTER_GROUPS.flatMap((g) => g.options);

export function buildKeywordsFromFilters(selected: Set<string>): string {
  return ALL_FILTER_OPTIONS
    .filter((o) => selected.has(o.id) && o.keyword)
    .map((o) => o.keyword)
    .join(' ');
}

interface FiltersSheetProps {
  visible: boolean;
  selected: Set<string>;
  onApply: (selected: Set<string>) => void;
  onClose: () => void;
}

export function FiltersSheet({ visible, selected, onApply, onClose }: FiltersSheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheet>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));

  if (!visible) return null;

  function toggle(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const count = draft.size;

  return (
    <BottomSheet ref={sheetRef} snapPoints={['60%']} enablePanDownToClose onClose={onClose}
      backgroundStyle={{ backgroundColor: '#0e1c1c' }} handleIndicatorStyle={{ backgroundColor: '#4a7a7a' }}>
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ color: '#e0ffff', fontSize: 17, fontWeight: '700' }}>
            {t('search.filtersSheetTitle', 'Bộ lọc bài hát')}
          </Text>
          <TouchableOpacity onPress={() => setDraft(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#7aa8a8', fontSize: 14 }}>{t('search.filtersReset', 'Đặt lại')}</Text>
          </TouchableOpacity>
        </View>

        {FILTER_GROUPS.map((group) => (
          <View key={group.labelKey} style={{ marginBottom: 16 }}>
            <Text style={{ color: '#7aa8a8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 }}>
              {t(group.labelKey)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {group.options.map((opt) => {
                const active = draft.has(opt.id);
                if (active) {
                  return (
                    <LinearGradient key={opt.id} colors={['#008b8b', '#006d6f', '#0d98ba']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 999 }}>
                      <TouchableOpacity onPress={() => toggle(opt.id)} activeOpacity={0.8} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  );
                }
                return (
                  <TouchableOpacity key={opt.id} onPress={() => toggle(opt.id)} activeOpacity={0.7} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#1f3a3a' }}>
                    <Text style={{ color: '#7aa8a8', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ))}

        {count > 0 ? (
          <LinearGradient colors={['#008b8b', '#006d6f', '#0d98ba']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, marginTop: 8 }}>
            <TouchableOpacity onPress={() => { onApply(draft); onClose(); }} activeOpacity={0.8} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                {t('search.filtersApply', 'Áp dụng {{count}} bộ lọc', { count })}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <TouchableOpacity onPress={() => { onApply(draft); onClose(); }} activeOpacity={0.8} style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: '#152a2a', marginTop: 8 }}>
            <Text style={{ color: '#7aa8a8', fontSize: 15, fontWeight: '600' }}>
              {t('search.filtersViewAll', 'Xem tất cả bài hát')}
            </Text>
          </TouchableOpacity>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

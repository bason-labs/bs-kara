export const FILTER_GROUPS = [
  {
    key: 'hinhThuc',
    labelKey: 'search.filterGroupHinhThuc',
    chips: [
      { id: 'don-ca',  label: 'Đơn ca',  keyword: 'đơn ca' },
      { id: 'song-ca', label: 'Song ca', keyword: 'song ca' },
    ],
  },
  {
    key: 'tongGiong',
    labelKey: 'search.filterGroupTongGiong',
    chips: [
      { id: 'tone-nam', label: 'Tone nam', keyword: 'tone nam' },
      { id: 'tone-nu',  label: 'Tone nữ',  keyword: 'tone nữ' },
    ],
  },
  {
    key: 'theLoai',
    labelKey: 'search.filterGroupTheLoai',
    chips: [
      { id: 'tru-tinh', label: 'Trữ tình', keyword: 'trữ tình' },
      { id: 'bolero',   label: 'Bolero',   keyword: 'bolero'   },
      { id: 'ca-co',    label: 'Ca cổ',    keyword: 'ca cổ'    },
      { id: 'nhac-tre', label: 'Nhạc trẻ', keyword: 'nhạc trẻ' },
    ],
  },
] as const;

export type FilterChipId = typeof FILTER_GROUPS[number]['chips'][number]['id'];

type FilterChip = { readonly id: FilterChipId; readonly label: string; readonly keyword: string };

export const FILTER_CHIPS: readonly FilterChip[] = FILTER_GROUPS.flatMap(
  (g) => g.chips as readonly FilterChip[],
);

export function buildChipKeywords(chips: Set<FilterChipId>): string {
  return FILTER_CHIPS.filter((c) => chips.has(c.id))
    .map((c) => c.keyword)
    .join(' ');
}

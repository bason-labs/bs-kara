import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomContext } from '@/context/RoomContext';
import { SongResultItem } from '@/components/SongResultItem';
import { RoomHeader } from '@/components/RoomHeader';
import type { YouTubeVideo } from '@bs-kara/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const FILTER_CHIPS = [
  { id: 'song-ca', label: 'Song ca', keyword: 'song ca' },
  { id: 'tone-nam', label: 'Tone nam', keyword: 'tone nam' },
  { id: 'tone-nu', label: 'Tone nữ', keyword: 'tone nữ' },
  { id: 'tru-tinh', label: 'Trữ tình', keyword: 'trữ tình' },
  { id: 'ca-co', label: 'Ca cổ', keyword: 'ca cổ' },
  { id: 'nhac-tre', label: 'Nhạc trẻ', keyword: 'nhạc trẻ' },
] as const;

export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addSongToQueue, roomData, roomCode } = useRoomContext();

  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const [requesterModalVisible, setRequesterModalVisible] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const pendingVideoRef = useRef<YouTubeVideo | null>(null);

  const search = useCallback(async (q: string, chipKeyword?: string) => {
    const base = q.trim() || 'nhạc trẻ karaoke';
    const term = chipKeyword ? `${base} ${chipKeyword}` : base;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/youtube/search?q=${encodeURIComponent(term)}`
      );
      const data = (await res.json()) as YouTubeVideo[];
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    search('');
  }, [search]);

  function handleChipPress(chip: typeof FILTER_CHIPS[number]) {
    if (activeChip === chip.id) {
      setActiveChip(null);
      search(query);
    } else {
      setActiveChip(chip.id);
      search(query, chip.keyword);
    }
  }

  function handleSearchSubmit() {
    const chip = FILTER_CHIPS.find((c) => c.id === activeChip);
    search(query, chip?.keyword);
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    if (text.trim() === '') {
      setActiveChip(null);
    }
  }

  function handleAddPress(video: YouTubeVideo) {
    if (roomData.requesterPromptEnabled) {
      pendingVideoRef.current = video;
      setRequesterName('');
      setRequesterModalVisible(true);
    } else {
      confirmAdd(video, null);
    }
  }

  function confirmAdd(video: YouTubeVideo, name: string | null) {
    addSongToQueue(video, name ?? null);
    setAdded((prev) => new Set(prev).add(video.id));
    setRequesterModalVisible(false);
    pendingVideoRef.current = null;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header */}
      <RoomHeader
        roomCode={roomCode}
        onLeave={() => router.replace('/join' as never)}
      />

      {/* Search bar */}
      <View className="flex-row items-center mx-4 mb-2 bg-[#0e1c1c] border border-[#1f3a3a] rounded-2xl px-4 py-3 gap-2">
        <Search size={18} color="#7aa8a8" />
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
          placeholder={t('search.placeholder')}
          placeholderTextColor="#7aa8a8"
          className="flex-1 text-[#e0ffff] text-sm"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
      >
        {FILTER_CHIPS.map((chip, i) => {
          const isActive = activeChip === chip.id;
          const marginRight = i < FILTER_CHIPS.length - 1 ? 8 : 0;
          if (isActive) {
            return (
              <LinearGradient
                key={chip.id}
                colors={['#008b8b', '#006d6f', '#0d98ba']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 999, marginRight }}
              >
                <TouchableOpacity
                  onPress={() => handleChipPress(chip)}
                  activeOpacity={0.8}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{chip.label}</Text>
                </TouchableOpacity>
              </LinearGradient>
            );
          }
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => handleChipPress(chip)}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#0e1c1c',
                borderWidth: 1,
                borderColor: '#1f3a3a',
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
                marginRight,
              }}
            >
              <Text style={{ color: '#7aa8a8', fontSize: 12 }}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Loading */}
      {isSearching && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#008b8b" />
        </View>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[#7aa8a8] text-sm text-center">
            {query.trim() ? t('search.noResults') : t('search.hotHitsLabel')}
          </Text>
        </View>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            !query.trim() && !activeChip ? (
              <Text className="text-xs uppercase tracking-[3px] text-[#7aa8a8] px-4 pt-2 pb-3">
                {'🔥 '}{t('search.hotHitsLabel')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <SongResultItem
              video={item}
              onAdd={() => handleAddPress(item)}
              added={added.has(item.id)}
            />
          )}
        />
      )}

      {/* Requester modal */}
      <Modal
        visible={requesterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRequesterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-[#0e1c1c] rounded-t-3xl px-6 pt-6 pb-10 gap-4">
            <Text className="text-[#e0ffff] text-lg font-bold">{t('requester.title')}</Text>
            <TextInput
              value={requesterName}
              onChangeText={setRequesterName}
              placeholder={t('requester.placeholder')}
              placeholderTextColor="#7aa8a8"
              className="bg-[#152a2a] text-[#e0ffff] border border-[#1f3a3a] rounded-xl px-4 py-3"
              autoFocus
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl border border-[#1f3a3a] items-center"
                onPress={() => {
                  if (pendingVideoRef.current) confirmAdd(pendingVideoRef.current, null);
                }}
              >
                <Text className="text-[#7aa8a8] font-semibold">{t('requester.skipButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-[#008b8b] items-center"
                onPress={() => {
                  if (pendingVideoRef.current) confirmAdd(pendingVideoRef.current, requesterName || null);
                }}
              >
                <Text className="text-[#e0ffff] font-semibold">{t('requester.confirmButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpLeft, History, Mic, Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomContext } from '@/context/RoomContext';
import { SongResultItem } from '@/components/SongResultItem';
import { RoomHeader } from '@/components/RoomHeader';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
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
  const { history, push: pushHistory } = useSearchHistory();

  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isFocused, setIsFocused] = useState(false);

  const { suggestions, clear: clearSuggestions } = useSearchSuggestions(isFocused ? query : '');

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [requesterModalVisible, setRequesterModalVisible] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const pendingVideoRef = useRef<YouTubeVideo | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = useCallback(async (q: string, chipKeyword?: string) => {
    const base = q.trim() || 'nhạc trẻ karaoke';
    const term = chipKeyword ? `${base} ${chipKeyword}` : base;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/youtube/search?q=${encodeURIComponent(term)}`
      );
      const data = (await res.json()) as YouTubeVideo[];
      const list = Array.isArray(data) ? data : [];
      setResults(list);
      if (q.trim()) pushHistory(q.trim(), list[0]?.thumbnail);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [pushHistory]);

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
    clearSuggestions();
    inputRef.current?.blur();
    setIsFocused(false);
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    if (text.trim() === '') setActiveChip(null);
  }

  function handleClearQuery() {
    setQuery('');
    clearSuggestions();
    inputRef.current?.focus();
  }

  function handleBack() {
    setIsFocused(false);
    clearSuggestions();
    inputRef.current?.blur();
  }

  function handleHistoryPress(q: string) {
    setQuery(q);
    setIsFocused(false);
    clearSuggestions();
    inputRef.current?.blur();
    const chip = FILTER_CHIPS.find((c) => c.id === activeChip);
    search(q, chip?.keyword);
  }

  function handleSuggestionFill(suggestion: string) {
    setQuery(suggestion);
    inputRef.current?.focus();
  }

  function handleSuggestionSearch(suggestion: string) {
    setQuery(suggestion);
    clearSuggestions();
    setIsFocused(false);
    inputRef.current?.blur();
    const chip = FILTER_CHIPS.find((c) => c.id === activeChip);
    search(suggestion, chip?.keyword);
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

  const showHistory = isFocused && query.trim() === '' && history.length > 0;
  const showSuggestions = isFocused && query.trim() !== '' && suggestions.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header — hidden while focused to give more room */}
      {!isFocused && (
        <RoomHeader
          roomCode={roomCode}
          onLeave={() => router.replace('/join' as never)}
          onSettings={() => setSettingsVisible(true)}
        />
      )}

      {/* Search bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: isFocused ? 12 : 0, marginBottom: 4, gap: 10 }}>
        {/* Back arrow (focused only) */}
        {isFocused && (
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={{ padding: 4 }}>
            <ArrowLeft size={22} color="#7aa8a8" />
          </TouchableOpacity>
        )}

        {/* Input pill */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#0e1c1c',
          borderWidth: isFocused ? 1.5 : 1,
          borderColor: isFocused ? '#008b8b' : '#1f3a3a',
          borderRadius: isFocused ? 14 : 999,
          paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setIsFocused(true)}
            returnKeyType="search"
            placeholder={t('search.placeholder')}
            placeholderTextColor="#7aa8a8"
            style={{ flex: 1, color: '#e0ffff', fontSize: 14 }}
          />
          {/* Right side: X clear (focused + has text) or search icon (idle) */}
          {isFocused && query.length > 0 ? (
            <TouchableOpacity onPress={handleClearQuery} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#7aa8a8" />
            </TouchableOpacity>
          ) : !isFocused ? (
            <TouchableOpacity onPress={handleSearchSubmit} activeOpacity={0.7}>
              <Search size={18} color="#7aa8a8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Mic button */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={{ width: 40, height: 40, borderRadius: 999,
            borderWidth: 1, borderColor: '#1f3a3a', backgroundColor: '#0e1c1c',
            alignItems: 'center', justifyContent: 'center' }}
        >
          <Mic size={18} color="#7aa8a8" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, overflow: 'visible' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, alignItems: 'center' }}
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
              style={{ backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a',
                borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginRight }}
            >
              <Text style={{ color: '#7aa8a8', fontSize: 12 }}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search history (shown when focused + empty query) */}
      {showHistory && (
        <FlatList
          data={history}
          keyExtractor={(item) => item.q}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleHistoryPress(item.q)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}
            >
              <History size={16} color="#7aa8a8" />
              <Text style={{ flex: 1, color: '#e0ffff', fontSize: 14 }} numberOfLines={1}>
                {item.q}
              </Text>
              {item.thumb ? (
                <Image source={{ uri: item.thumb }}
                  style={{ width: 48, height: 32, borderRadius: 4, backgroundColor: '#152a2a' }} />
              ) : null}
              <TouchableOpacity
                onPress={() => handleHistoryPress(item.q)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowUpLeft size={16} color="#7aa8a8" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Autocomplete suggestions (focused + typing) */}
      {showSuggestions && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 16, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
              <Search size={16} color="#7aa8a8" />
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.7}
                onPress={() => handleSuggestionSearch(item)}
              >
                <Text style={{ color: '#e0ffff', fontSize: 14 }} numberOfLines={1}>{item}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSuggestionFill(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowUpLeft size={16} color="#7aa8a8" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Loading */}
      {!showHistory && !showSuggestions && isSearching && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#008b8b" />
        </View>
      )}

      {/* Empty state */}
      {!showHistory && !showSuggestions && !isSearching && results.length === 0 && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[#7aa8a8] text-sm text-center">
            {query.trim() ? t('search.noResults') : t('search.hotHitsLabel')}
          </Text>
        </View>
      )}

      {/* Results */}
      {!showHistory && !showSuggestions && !isSearching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
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

      {/* Settings sheet */}
      <SettingsSheet isOpen={settingsVisible} onClose={() => setSettingsVisible(false)} />

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

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, Image, Modal,
  TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle, ArrowLeft, ArrowUpLeft, History,
  Mic, Search, SearchX, WifiOff, X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomContext } from '@/context/RoomContext';
import { SongResultItem } from '@/components/SongResultItem';
import { SearchSkeleton } from '@/components/SearchSkeleton';
import { AddedToast } from '@/components/AddedToast';
import { VoiceSearchModal } from '@/components/VoiceSearchModal';
import { RoomHeader } from '@/components/RoomHeader';
import { useSettingsContext } from '@/context/SettingsContext';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
import { useQueuedMap } from '@/hooks/useQueuedMap';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
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
  const { history, push: pushHistory, remove: removeHistory } = useSearchHistory();

  const [query, setQuery] = useState('');
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<'quota' | 'generic' | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isFocused, setIsFocused] = useState(false);
  const { openSettings } = useSettingsContext();
  const [toastVideo, setToastVideo] = useState<YouTubeVideo | null>(null);
  const [requesterModalVisible, setRequesterModalVisible] = useState(false);
  const [requesterName, setRequesterName] = useState('');

  const pendingVideoRef = useRef<YouTubeVideo | null>(null);
  const inputRef = useRef<TextInput>(null);
  const panelInputRef = useRef<TextInput>(null);

  const { suggestions, clear: clearSuggestions } = useSearchSuggestions(isFocused ? query : '');
  const queuedMap = useQueuedMap(roomData?.queue ?? []);

  const buildTerm = useCallback((q: string, chips: Set<string>) => {
    const chipKeywords = FILTER_CHIPS
      .filter((c) => chips.has(c.id))
      .map((c) => c.keyword)
      .join(' ');
    return [q.trim(), chipKeywords].filter(Boolean).join(' ') || 'nhạc trẻ karaoke';
  }, []);

  const search = useCallback(async (term: string) => {
    setSearchError(null);
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`${API_BASE}/api/youtube/search?q=${encodeURIComponent(term)}`);
      if (res.status === 429 || res.status === 403) {
        setSearchError('quota');
        setResults([]);
        return;
      }
      if (!res.ok) {
        setSearchError('generic');
        setResults([]);
        return;
      }
      const data = (await res.json()) as YouTubeVideo[];
      const list = Array.isArray(data) ? data : [];
      setResults(list);
    } catch {
      setSearchError('generic');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const { isListening, interimTranscript, start: startVoice, stop: stopVoice } = useVoiceSearch({
    onFinal: (text) => {
      setQuery(text);
      setIsFocused(false);
      void search(buildTerm(text, activeChips));
    },
    onUnsupported: () => setSearchError('generic'),
  });

  useEffect(() => {
    void search(buildTerm('', new Set()));
  }, [search, buildTerm]);

  useEffect(() => {
    if (isFocused) panelInputRef.current?.focus();
  }, [isFocused]);

  function handleSearchSubmit() {
    const term = buildTerm(query, activeChips);
    if (query.trim()) pushHistory(query.trim(), results[0]?.thumbnail);
    clearSuggestions();
    inputRef.current?.blur();
    setIsFocused(false);
    void search(term);
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    if (text.trim() === '') setActiveChips(new Set());
  }

  function handleClearQuery() {
    setQuery('');
    clearSuggestions();
    panelInputRef.current?.focus();
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
    void search(buildTerm(q, activeChips));
  }

  function handleSuggestionFill(suggestion: string) {
    setQuery(suggestion);
    panelInputRef.current?.focus();
  }

  function handleSuggestionSearch(suggestion: string) {
    setQuery(suggestion);
    clearSuggestions();
    setIsFocused(false);
    inputRef.current?.blur();
    if (suggestion.trim()) pushHistory(suggestion.trim());
    void search(buildTerm(suggestion, activeChips));
  }

  function handleAddPress(video: YouTubeVideo) {
    if (roomData?.requesterPromptEnabled) {
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
    setToastVideo(video);
    setRequesterModalVisible(false);
    pendingVideoRef.current = null;
  }

  function renderChips(chips: Set<string>, onToggle: (chip: typeof FILTER_CHIPS[number]) => void) {
    return FILTER_CHIPS.map((chip, i) => {
      const isActive = chips.has(chip.id);
      const marginRight = i < FILTER_CHIPS.length - 1 ? 8 : 0;
      if (isActive) {
        return (
          <LinearGradient key={chip.id}
            colors={['#008b8b', '#006d6f', '#0d98ba']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 999, marginRight }}>
            <TouchableOpacity onPress={() => onToggle(chip)} activeOpacity={0.8}
              style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{chip.label}</Text>
            </TouchableOpacity>
          </LinearGradient>
        );
      }
      return (
        <TouchableOpacity key={chip.id} onPress={() => onToggle(chip)} activeOpacity={0.7}
          style={{ backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a',
            borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginRight }}>
          <Text style={{ color: '#7aa8a8', fontSize: 12 }}>{chip.label}</Text>
        </TouchableOpacity>
      );
    });
  }

  function renderErrorState() {
    if (searchError === 'quota') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <AlertCircle size={36} color="#f59e0b" />
          <Text style={{ color: '#f59e0b', fontSize: 15, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            {t('search.errorQuotaTitle')}
          </Text>
          <Text style={{ color: '#7aa8a8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            {t('search.errorQuotaSubtitle')}
          </Text>
        </View>
      );
    }
    if (searchError === 'generic') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <WifiOff size={36} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 15, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            {t('search.errorGenericTitle')}
          </Text>
          <Text style={{ color: '#7aa8a8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            {t('search.errorGenericSubtitle')}
          </Text>
        </View>
      );
    }
    if (hasSearched && results.length === 0 && !searchError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <SearchX size={36} color="#7aa8a8" />
          <Text style={{ color: '#e0ffff', fontSize: 15, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
            {t('search.errorNoResultsTitle')}
          </Text>
          <Text style={{ color: '#7aa8a8', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            {t('search.errorNoResultsSubtitle')}
          </Text>
        </View>
      );
    }
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
      {!isFocused && (
        <RoomHeader
          roomCode={roomCode}
          onLeave={() => router.replace('/join' as never)}
          onSettings={openSettings}
        />
      )}

      {/* Search bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 0, marginBottom: 4, gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a',
          borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
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
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => { setQuery(''); clearSuggestions(); }}
              activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#7aa8a8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSearchSubmit} activeOpacity={0.7}>
              <Search size={18} color="#7aa8a8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={() => void startVoice()}
          style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 1,
            borderColor: '#1f3a3a', backgroundColor: '#0e1c1c',
            alignItems: 'center', justifyContent: 'center' }}>
          <Mic size={18} color="#7aa8a8" />
        </TouchableOpacity>
      </View>

      {/* Filter chips — main screen */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexShrink: 0, overflow: 'visible' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4,
          paddingBottom: 12, alignItems: 'center' }}>
        {renderChips(activeChips, (chip) => {
          const next = new Set(activeChips);
          next.has(chip.id) ? next.delete(chip.id) : next.add(chip.id);
          setActiveChips(next);
          void search(buildTerm(query, next));
        })}
        {activeChips.size > 0 && (
          <TouchableOpacity onPress={() => {
            setActiveChips(new Set());
            void search(buildTerm(query, new Set()));
          }} activeOpacity={0.7}
            style={{ marginLeft: 4, paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 999, borderWidth: 1, borderColor: '#4a7a7a' }}>
            <Text style={{ color: '#4a7a7a', fontSize: 12 }}>
              {t('search.clearFilters', { count: activeChips.size })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Loading skeleton */}
      {isSearching && <SearchSkeleton />}

      {/* Error / empty states */}
      {!isSearching && renderErrorState()}

      {/* Results */}
      {!isSearching && !searchError && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            !query.trim() && activeChips.size === 0 ? (
              <Text style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 3,
                color: '#7aa8a8', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                {'🔥 '}{t('search.hotHitsLabel')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <SongResultItem
              video={item}
              onAdd={() => handleAddPress(item)}
              added={added.has(item.id)}
              queued={queuedMap.has(item.id)}
              isCurrentlyPlaying={roomData?.currentPlaying?.id === item.id}
            />
          )}
        />
      )}

      {/* Focused search overlay */}
      <Modal visible={isFocused} animationType="fade" transparent={false} onRequestClose={handleBack}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#06100f' }}>
          <KeyboardAvoidingView style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

            {/* Top bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 8, paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: '#1f3a3a', gap: 8 }}>
              <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={{ padding: 8 }}>
                <ArrowLeft size={22} color="#7aa8a8" />
              </TouchableOpacity>
              <TextInput
                ref={panelInputRef}
                value={query}
                onChangeText={handleQueryChange}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                placeholder={t('search.placeholder')}
                placeholderTextColor="#7aa8a8"
                style={{ flex: 1, backgroundColor: '#0e1c1c', color: '#e0ffff',
                  fontSize: 14, borderRadius: 999,
                  paddingHorizontal: 16, paddingVertical: 8,
                  borderWidth: 1, borderColor: '#1f3a3a' }}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={handleClearQuery} activeOpacity={0.7}
                  style={{ padding: 8, borderRadius: 999,
                    backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a' }}>
                  <X size={20} color="#7aa8a8" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => void startVoice()} activeOpacity={0.7}
                  style={{ padding: 8, borderRadius: 999,
                    backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a' }}>
                  <Mic size={20} color="#7aa8a8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Chip row in overlay */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 0, borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}
              contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' }}>
              {renderChips(activeChips, (chip) => {
                const next = new Set(activeChips);
                next.has(chip.id) ? next.delete(chip.id) : next.add(chip.id);
                setActiveChips(next);
                void search(buildTerm(query, next));
              })}
            </ScrollView>

            {/* History list */}
            {query.trim() === '' && (
              <FlatList
                data={history}
                keyExtractor={(item) => item.q}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={{ height: 52, flexDirection: 'row', alignItems: 'center',
                    borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
                    <TouchableOpacity onPress={() => handleHistoryPress(item.q)} activeOpacity={0.7}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
                        gap: 12, paddingHorizontal: 16, height: '100%' }}>
                      <History size={18} color="#7aa8a8" style={{ flexShrink: 0 }} />
                      <Text style={{ flex: 1, color: '#e0ffff', fontSize: 15 }} numberOfLines={1}>
                        {item.q}
                      </Text>
                      {item.thumb ? (
                        <Image source={{ uri: item.thumb }}
                          style={{ width: 56, height: 36, borderRadius: 4, backgroundColor: '#152a2a' }} />
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSuggestionFill(item.q)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={{ paddingHorizontal: 8 }}>
                      <ArrowUpLeft size={18} color="#7aa8a8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeHistory(item.q)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={{ paddingHorizontal: 12 }}>
                      <X size={16} color="#4a7a7a" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            {/* Suggestions list */}
            {query.trim() !== '' && (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center',
                    borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}>
                    <TouchableOpacity onPress={() => handleSuggestionSearch(item)} activeOpacity={0.7}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center',
                        gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Search size={18} color="#7aa8a8" style={{ flexShrink: 0 }} />
                      <Text style={{ flex: 1, color: '#e0ffff', fontSize: 15 }} numberOfLines={1}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSuggestionFill(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ paddingHorizontal: 16 }}>
                      <ArrowUpLeft size={18} color="#7aa8a8" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Voice search modal */}
      <VoiceSearchModal
        visible={isListening}
        interimTranscript={interimTranscript}
        onClose={stopVoice}
      />

      {/* Added toast */}
      {toastVideo && (
        <AddedToast
          video={toastVideo}
          onViewQueue={() => { router.navigate('/(room)/queue'); setToastVideo(null); }}
          onDismiss={() => setToastVideo(null)}
        />
      )}

      {/* Requester modal */}
      <Modal visible={requesterModalVisible} transparent animationType="slide"
        onRequestClose={() => setRequesterModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#0e1c1c', borderTopLeftRadius: 24,
            borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 16 }}>
            <Text style={{ color: '#e0ffff', fontSize: 18, fontWeight: '700' }}>
              {t('requester.title')}
            </Text>
            <TextInput
              value={requesterName}
              onChangeText={setRequesterName}
              placeholder={t('requester.placeholder')}
              placeholderTextColor="#7aa8a8"
              style={{ backgroundColor: '#152a2a', color: '#e0ffff',
                borderWidth: 1, borderColor: '#1f3a3a', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12 }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1, borderColor: '#1f3a3a', alignItems: 'center' }}
                onPress={() => { if (pendingVideoRef.current) confirmAdd(pendingVideoRef.current, null); }}>
                <Text style={{ color: '#7aa8a8', fontWeight: '600' }}>{t('requester.skipButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: '#008b8b', alignItems: 'center' }}
                onPress={() => {
                  if (pendingVideoRef.current) confirmAdd(pendingVideoRef.current, requesterName || null);
                }}>
                <Text style={{ color: '#e0ffff', fontWeight: '600' }}>{t('requester.confirmButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

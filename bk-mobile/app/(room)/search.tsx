import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import { useRoomContext } from '@/context/RoomContext';
import { SongResultItem } from '@/components/SongResultItem';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { YouTubeVideo } from '@bs-kara/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { addSongToQueue, roomData } = useRoomContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [hotHitsLoaded, setHotHitsLoaded] = useState(false);

  const [requesterModalVisible, setRequesterModalVisible] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const pendingVideoRef = useRef<YouTubeVideo | null>(null);

  const search = useCallback(async (q: string) => {
    const term = q.trim() || 'nhạc trẻ karaoke';
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/youtube/search?q=${encodeURIComponent(term)}`
      );
      const data = (await res.json()) as YouTubeVideo[];
      setResults(Array.isArray(data) ? data : []);
      if (!q.trim()) setHotHitsLoaded(true);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

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

  const showHotHitsPrompt = results.length === 0 && !isSearching && !hotHitsLoaded;

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2 gap-3">
        <Text className="text-[#e0ffff] text-lg font-bold flex-1">BS Kara</Text>
        <ThemeToggle />
      </View>

      {/* Search bar */}
      <View className="flex-row items-center mx-4 mb-3 bg-[#0e1c1c] border border-[#1f3a3a] rounded-2xl px-4 py-3 gap-2">
        <Search size={18} color="#7aa8a8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          returnKeyType="search"
          placeholder={t('search.placeholder')}
          placeholderTextColor="#7aa8a8"
          className="flex-1 text-[#e0ffff] text-sm"
        />
      </View>

      {/* Loading */}
      {isSearching && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#008b8b" />
        </View>
      )}

      {/* Hot hits prompt */}
      {showHotHitsPrompt && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[#7aa8a8] text-sm text-center">{t('search.hotHitsLabel')}</Text>
          <TouchableOpacity
            className="mt-4 px-6 py-3 border border-[#008b8b] rounded-full"
            onPress={() => search('')}
          >
            <Text className="text-[#008b8b] text-sm font-semibold">Xem bài hot</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {!isSearching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
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

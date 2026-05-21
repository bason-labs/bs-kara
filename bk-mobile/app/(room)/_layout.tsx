import { Tabs, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, ListMusic, Disc3 } from 'lucide-react-native';
import { RoomProvider, useRoomContext } from '@/context/RoomContext';

function TabBarLayout() {
  const { t } = useTranslation();
  const { roomData } = useRoomContext();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0e1c1c',
          borderTopColor: '#1f3a3a',
          height: 64,
        },
        tabBarActiveTintColor: '#40e0d0',
        tabBarInactiveTintColor: '#7aa8a8',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: t('tabs.queue'),
          tabBarIcon: ({ color }) => <ListMusic size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: t('tabs.player'),
          tabBarIcon: ({ color }) => <Disc3 size={22} color={color} />,
          href: roomData.isTvActive ? null : undefined,
        }}
      />
    </Tabs>
  );
}

export default function RoomLayout() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  return (
    <RoomProvider roomCode={roomCode ?? ''}>
      <TabBarLayout />
    </RoomProvider>
  );
}

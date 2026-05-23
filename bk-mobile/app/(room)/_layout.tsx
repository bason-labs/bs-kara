import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { RoomProvider, useRoomContext } from '@/context/RoomContext';
import { BottomNav, type NavTab } from '@/components/BottomNav';
import { SettingsContext } from '@/context/SettingsContext';

const NAV_TABS = new Set<NavTab>(['search', 'queue', 'player']);

function TabBarLayout() {
  const { roomData } = useRoomContext();
  const router = useRouter();

  return (
    <SettingsContext.Provider value={{ openSettings: () => router.push('/(room)/settings') }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const rawName = props.state.routes[props.state.index]?.name ?? 'search';
          if (rawName === 'settings') return null;
          const routeName: NavTab = NAV_TABS.has(rawName as NavTab) ? (rawName as NavTab) : 'search';
          return (
            <BottomNav
              activeTab={routeName}
              isPlaying={roomData.isPlaying}
              queueLength={roomData.queue.length}
              onTabChange={(tab) => {
                const route = props.state.routes.find((r) => r.name === tab);
                if (route) props.navigation.navigate(route.name);
              }}
            />
          );
        }}
      >
        <Tabs.Screen name="search" />
        <Tabs.Screen name="queue" />
        <Tabs.Screen name="player" />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </SettingsContext.Provider>
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

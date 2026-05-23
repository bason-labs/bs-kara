import { useState } from 'react';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { RoomProvider, useRoomContext } from '@/context/RoomContext';
import { BottomNav, type NavTab } from '@/components/BottomNav';
import { SettingsSheet } from '@/components/SettingsSheet';
import { SettingsContext } from '@/context/SettingsContext';

function TabBarLayout() {
  const { roomData } = useRoomContext();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <SettingsContext.Provider value={{ openSettings: () => setSettingsOpen(true) }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const NAV_TABS = new Set<NavTab>(['search', 'queue', 'player']);
          const rawName = props.state.routes[props.state.index]?.name ?? 'search';
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
      </Tabs>
      <SettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
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

import '../global.css';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/context/ThemeContext';
import { i18n } from '@bs-kara/shared/hooks';

// Ensure i18n singleton is initialized before any screen renders.
void i18n;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Suspense fallback={<Text>Loading…</Text>}>
          <Stack screenOptions={{ headerShown: false }} />
        </Suspense>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

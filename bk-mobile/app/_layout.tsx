import '../global.css';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { Text } from 'react-native';

export default function RootLayout() {
  return (
    <Suspense fallback={<Text>Loading…</Text>}>
      <Stack screenOptions={{ headerShown: false }} />
    </Suspense>
  );
}

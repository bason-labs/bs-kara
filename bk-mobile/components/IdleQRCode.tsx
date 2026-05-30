import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

export interface IdleQRCodeProps {
  roomCode: string | null;
  /** QR module pixel size — TV gets ~280, mobile fullscreen ~200. Default 240. */
  size?: number;
}

const CARD_PADDING = 16;
const SITE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Shared idle / empty-state QR code panel.
 * Renders a white-padded QR pointing to the web join URL, a "scan to join"
 * label, and the room code pill. Mirrors bk-web/components/IdleQRCode.tsx
 * but uses react-native-qrcode-svg instead of qrcode.react and
 * React Native primitives instead of div/p elements.
 */
export function IdleQRCode({ roomCode, size = 240 }: IdleQRCodeProps): React.ReactElement {
  const { t } = useTranslation();

  // Derive join URL synchronously — no window.location in RN; we read the
  // EXPO_PUBLIC_API_BASE_URL env var at module level instead.
  const joinUrl = useMemo(() => {
    if (!roomCode || !SITE_URL) return null;
    return `${SITE_URL}/?room=${roomCode}`;
  }, [roomCode]);

  return (
    <View className="items-center justify-center gap-4 px-6">
      {/* Waiting message */}
      <Text className="text-sm text-[#9ca3af] text-center">
        {t('tv.waitingMessage')}
      </Text>

      {/* White QR card */}
      <View
        className="bg-white rounded-2xl items-center justify-center"
        style={{ padding: CARD_PADDING }}
      >
        {joinUrl ? (
          <QRCode value={joinUrl} size={size} ecl="M" />
        ) : (
          <View style={{ width: size, height: size }} />
        )}
      </View>

      {/* "Scan to join" label */}
      <Text className="text-sm font-medium text-[#e0ffff] text-center">
        {t('tv.scanToJoin')}
      </Text>

      {/* Room code pill */}
      <View className="flex-row items-center gap-2">
        <Text className="text-[10px] uppercase tracking-widest text-[#9ca3af]">
          {t('header.roomLabel')}
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: '#008b8b' }}
        >
          <Text
            className="text-base font-bold text-white tracking-widest"
            style={{ letterSpacing: 4.8 }}
          >
            {roomCode ?? '----'}
          </Text>
        </View>
      </View>
    </View>
  );
}

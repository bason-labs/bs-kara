import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Coffee } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';

interface AdIntermissionOverlayProps {
  nextSongTitle?: string | null;
}

// Opaque cover shown over the fullscreen player while an ad plays, so the room
// never sees the ad. Audio is silenced separately via the player's mute prop.
export function AdIntermissionOverlay({ nextSongTitle }: AdIntermissionOverlayProps): React.ReactElement {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View style={styles.container}>
      <Coffee size={28} color="#f9a8d4" />
      <Text style={styles.title}>{t('adMask.title')}</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>{t('adMask.subtitle')}</Text>
      {nextSongTitle ? (
        <Text style={styles.nextUp}>
          {t('adMask.nextUp')} <Text style={styles.nextUpTitle}>{nextSongTitle}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  nextUp: { color: '#f9a8d4', fontSize: 14, textAlign: 'center' },
  nextUpTitle: { color: '#ffffff', fontWeight: '600' },
});

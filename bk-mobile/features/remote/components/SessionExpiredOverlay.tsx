import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SessionExpiredOverlayProps {
  timedOut: boolean;
  rejoinReason: string | null;
  onRejoin: () => void;
}

// Full-screen overlay shown when useInactivityTimeout fires. `rejoinReason`
// is null until the first rejoin attempt. If the first rejoin succeeds the
// overlay is dismissed (timedOut resets to false). If it fails, `rejoinReason`
// tells us why so we can swap the copy without navigating away.
//
// React Native adaptations vs. the bk-web version:
//   - <Modal visible={timedOut} transparent animationType="fade"> replaces the
//     fixed-position <div role="alertdialog">. Modal absorbs all touches by
//     default on RN so no explicit stopPropagation is needed.
//   - Semi-transparent rgba background replaces "bg-bg/95 backdrop-blur-md"
//     since backdrop-filter is not supported in React Native.
//   - <TouchableOpacity> + <LinearGradient> replaces <button className="bg-gradient-brand">.
export function SessionExpiredOverlay({
  timedOut,
  rejoinReason,
  onRejoin,
}: SessionExpiredOverlayProps): React.ReactElement | null {
  if (!timedOut) return null;

  const isHardBlocked = rejoinReason === 'subscription_expired';

  let title = 'Phiên của bạn đã hết hạn do không hoạt động';
  if (rejoinReason === 'subscription_expired') {
    title = 'Phòng không còn hoạt động';
  }

  return (
    <Modal
      visible={timedOut}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      accessibilityLabel={title}
    >
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>

          {!isHardBlocked && (
            <>
              <Text style={styles.subtitle}>
                Nhấn để tiếp tục tham gia phòng.
              </Text>

              <TouchableOpacity
                onPress={onRejoin}
                activeOpacity={0.8}
                style={styles.buttonWrapper}
                accessibilityRole="button"
                accessibilityLabel="Tham gia lại"
              >
                <LinearGradient
                  colors={['#008b8b', '#006d6f', '#0d98ba']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonLabel}>Tham gia lại</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Replicates "bg-bg/95" — dark teal at 95% opacity; no backdrop-blur in RN.
    backgroundColor: 'rgba(6, 16, 15, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#e0ffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#7aa8a8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonWrapper: {
    borderRadius: 9999,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

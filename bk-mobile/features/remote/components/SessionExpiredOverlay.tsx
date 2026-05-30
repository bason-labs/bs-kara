import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

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
  const c = useColors();

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
      <View
        style={{
          flex: 1,
          // Replicates "bg-bg/95" — dark teal at 95% opacity; no backdrop-blur in RN.
          backgroundColor: `${c.bg}f2`,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              color: c.fg,
              fontSize: 18,
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {title}
          </Text>

          {!isHardBlocked && (
            <>
              <Text
                style={{
                  color: c.muted,
                  fontSize: 14,
                  textAlign: 'center',
                  marginBottom: 24,
                }}
              >
                Nhấn để tiếp tục tham gia phòng.
              </Text>

              <TouchableOpacity
                onPress={onRejoin}
                activeOpacity={0.8}
                style={{ borderRadius: 9999, overflow: 'hidden' }}
                accessibilityRole="button"
                accessibilityLabel="Tham gia lại"
              >
                <LinearGradient
                  colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 32,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                    Tham gia lại
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

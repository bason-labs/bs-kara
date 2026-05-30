import { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const snapPoints = useMemo(() => ['30%'], []);
  const c = useColors();

  if (!open) return null;

  return (
    <BottomSheet
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onCancel}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
      backgroundStyle={{
        backgroundColor: c.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: '#4a7a7a' }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 16 }}>
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{message}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.7}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
          >
            <Text style={{ color: c.muted, fontWeight: '600' }}>{cancelLabel}</Text>
          </TouchableOpacity>
          <LinearGradient
            colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 12 }}
          >
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.8}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmLabel}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <View
          style={{ width: '100%', backgroundColor: '#0e1c1c', borderRadius: 20, padding: 24, gap: 16 }}
        >
          <Text style={{ color: '#e0ffff', fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: '#7aa8a8', fontSize: 14, lineHeight: 20 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1f3a3a', alignItems: 'center' }}
            >
              <Text style={{ color: '#7aa8a8', fontWeight: '600' }}>{cancelLabel}</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={['#008b8b', '#006d6f', '#0d98ba']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: 12 }}
            >
              <TouchableOpacity
                onPress={onConfirm}
                activeOpacity={0.8}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmLabel}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from './ui';

export type ToastTone = 'success' | 'error';

interface ToastProps {
  visible: boolean;
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
}

export const Toast = ({
  visible,
  message,
  tone = 'success',
  onDismiss,
}: ToastProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        pointerEvents="none"
        style={[
          styles.overlay,
          { paddingBottom: Math.max(insets.bottom + 82, 96) },
        ]}
      >
        {message ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              tone === 'error' ? styles.toastError : styles.toastSuccess,
            ]}
          >
            <Feather
              name={tone === 'error' ? 'alert-circle' : 'check-circle'}
              size={18}
              color="#fff"
            />
            <Text style={styles.text}>{message}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  toastSuccess: {
    backgroundColor: palette.primary,
  },
  toastError: {
    backgroundColor: palette.danger,
  },
  text: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
});

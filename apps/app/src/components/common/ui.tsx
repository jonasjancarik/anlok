import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const palette = {
  canvas: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#4F46E5',
  primaryActive: '#4338CA',
  danger: '#EF4444',
  dangerActive: '#DC2626',
  success: '#10B981',
  warning: '#F59E0B',
};

export const shadows = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  android: {
    elevation: 4,
  },
  web: {
    boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.05), 0 4px 6px -2px rgba(15, 23, 42, 0.025)' as any,
  },
}) || {};

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: 'default' | 'small' | 'icon';
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export const Screen = ({ children, noPadding = false }: { children: React.ReactNode; noPadding?: boolean }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: noPadding ? 0 : insets.top }]}>
      {children}
    </View>
  );
};

export const PageScroll = ({ children }: { children: React.ReactNode }) => (
  <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView>
);

export const SectionCard = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <View style={[styles.card, shadows]}>
    {title && <Text style={styles.cardTitle}>{title}</Text>}
    <View style={styles.cardBody}>{children}</View>
  </View>
);

export const Banner = ({
  type,
  text,
}: {
  type: 'error' | 'success' | 'info';
  text: string;
}) => {
  const background =
    type === 'error' ? '#FEF2F2' : type === 'success' ? '#ECFDF5' : '#EFF6FF';
  const color =
    type === 'error' ? '#B91C1C' : type === 'success' ? '#047857' : '#1D4ED8';
  const borderColor = 
    type === 'error' ? '#FECACA' : type === 'success' ? '#A7F3D0' : '#BFDBFE';

  return (
    <View style={[styles.banner, { backgroundColor: background, borderColor, borderWidth: 1 }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
};

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Input = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor="#94A3B8"
    {...props}
    style={[styles.input, props.multiline ? styles.inputMultiline : null, props.style]}
  />
);

export const Button = ({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'default',
  style,
  icon,
}: ButtonProps) => {
  const variantStyles = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    danger: styles.buttonDanger,
    ghost: styles.buttonGhost,
  }[variant];

  const sizeStyles = {
    default: styles.buttonSizeDefault,
    small: styles.buttonSizeSmall,
    icon: styles.buttonSizeIcon,
  }[size];

  const variantTextStyles = {
    primary: styles.buttonPrimaryText,
    secondary: styles.buttonSecondaryText,
    danger: styles.buttonDangerText,
    ghost: styles.buttonGhostText,
  }[variant];

  const sizeTextStyles = {
    default: styles.buttonTextSizeDefault,
    small: styles.buttonTextSizeSmall,
    icon: {},
  }[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyles,
        sizeStyles,
        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : { transform: [{ scale: 1 }] },
        disabled || loading ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? palette.primary : '#ffffff'} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: size === 'small' ? 4 : 6, justifyContent: 'center' }}>
          {icon}
          {size !== 'icon' && <Text style={[styles.buttonText, variantTextStyles, sizeTextStyles]}>{title}</Text>}
        </View>
      )}
    </Pressable>
  );
};

export const Horizontal = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.horizontal, style]}>{children}</View>
);

export const Row = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.row, style]}>{children}</View>
);

export const SubtleText = ({ children, style }: { children: React.ReactNode, style?: any }) => (
  <Text style={[styles.subtleText, style]}>{children}</Text>
);

export const Divider = () => <View style={styles.divider} />;

export const Chip = ({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) => {
  const color =
    tone === 'success' ? '#065f46' : tone === 'danger' ? '#991b1b' : tone === 'warning' ? '#92400E' : '#1e3a8a';
  const background =
    tone === 'success' ? '#d1fae5' : tone === 'danger' ? '#fee2e2' : tone === 'warning' ? '#FEF3C7' : '#dbeafe';

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </View>
  );
};

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scrollContent: {
    gap: 16,
    padding: 20,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  cardTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: -0.5,
  },
  cardBody: {
    gap: 12,
  },
  banner: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonSizeDefault: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  buttonSizeSmall: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  buttonSizeIcon: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 36,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
  },
  buttonSecondary: {
    backgroundColor: '#F1F5F9',
  },
  buttonDanger: {
    backgroundColor: palette.danger,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '700',
  },
  buttonTextSizeDefault: {
    fontSize: 16,
  },
  buttonTextSizeSmall: {
    fontSize: 13,
  },
  buttonPrimaryText: {
    color: '#ffffff',
  },
  buttonSecondaryText: {
    color: '#334155',
  },
  buttonDangerText: {
    color: '#ffffff',
  },
  buttonGhostText: {
    color: palette.primary,
  },
  horizontal: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  subtleText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 8,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

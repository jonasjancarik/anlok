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
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const palette = {
  canvas: '#F4F0E8',
  card: '#FFFCF6',
  raised: '#FFFFFF',
  field: '#FBF7F0',
  border: '#DDD3C4',
  borderStrong: '#C7B9A6',
  text: '#17201A',
  muted: '#6E756D',
  subtle: '#928877',
  primary: '#176B54',
  primaryActive: '#10523F',
  primarySoft: '#DDEBE4',
  danger: '#B5473F',
  dangerActive: '#933932',
  success: '#27765A',
  warning: '#A8641C',
};

export const shadows = Platform.select({
  ios: {
    shadowColor: '#2B2118',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  android: {
    elevation: 2,
  },
  web: {
    boxShadow: '0 14px 30px rgba(43, 33, 24, 0.055)' as any,
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
    type === 'error' ? '#F8E8E4' : type === 'success' ? '#E5F1EA' : '#EFE8DB';
  const color =
    type === 'error' ? palette.danger : type === 'success' ? palette.success : palette.warning;
  const borderColor = 
    type === 'error' ? '#E5B7AF' : type === 'success' ? '#BDD8CA' : '#DDCDB4';

  return (
    <View style={[styles.banner, { backgroundColor: background, borderColor, borderWidth: 1 }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
};

export const FieldLabel = ({ children, style }: { children: React.ReactNode, style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.label, style as any]}>{children}</Text>
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
    tone === 'success' ? palette.success : tone === 'danger' ? palette.danger : tone === 'warning' ? palette.warning : palette.primary;
  const background =
    tone === 'success' ? '#E3F1EA' : tone === 'danger' ? '#F8E8E4' : tone === 'warning' ? '#F4E7D4' : palette.primarySoft;

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
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  cardTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: 0,
  },
  cardBody: {
    gap: 12,
  },
  banner: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.field,
    borderRadius: 8,
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  buttonSizeSmall: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  buttonSizeIcon: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 36,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
  },
  buttonSecondary: {
    backgroundColor: '#F0E9DE',
    borderColor: palette.border,
    borderWidth: 1,
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
    letterSpacing: 0,
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
    color: palette.text,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

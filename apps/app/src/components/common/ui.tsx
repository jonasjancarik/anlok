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
import { Feather } from '@expo/vector-icons';
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
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  <ScrollView
    contentContainerStyle={styles.scrollContent}
    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {children}
  </ScrollView>
);

export const SectionCard = ({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) => (
  <View style={[styles.card, shadows]}>
    {title || description ? (
      <View style={styles.cardHeading}>
        {title ? <Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text> : null}
        {description ? <Text style={styles.subtleText}>{description}</Text> : null}
      </View>
    ) : null}
    <View style={styles.cardBody}>{children}</View>
  </View>
);

export const ScreenHeader = ({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.screenHeader}>
    <View style={styles.screenHeaderCopy}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.subtleText}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>
);

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  count?: number;
}

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) => (
  <View accessibilityRole="tablist" style={styles.segments}>
    {options.map((option) => {
      const selected = option.key === value;
      const color = selected ? palette.text : palette.muted;
      return (
        <Pressable
          key={option.key}
          accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          onPress={() => onChange(option.key)}
          style={({ pressed }) => [
            styles.segment,
            selected ? [styles.segmentSelected, shadows] : null,
            pressed && !selected ? { opacity: 0.7 } : null,
          ]}
        >
          {option.icon ? <Feather name={option.icon} size={15} color={color} /> : null}
          <Text numberOfLines={1} style={[styles.segmentText, { color }]}>{option.label}</Text>
          {option.count !== undefined ? (
            <Text style={[styles.segmentCount, selected ? { color: palette.primary } : null]}>{option.count}</Text>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

export const Avatar = ({ name, size = 40, muted = false }: { name: string; size?: number; muted?: boolean }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[
      styles.avatar,
      { borderRadius: size / 2, height: size, width: size },
      muted ? styles.avatarMuted : null,
    ]}
  >
    <Text style={[styles.avatarText, { fontSize: size * 0.38 }, muted ? { color: palette.muted } : null]}>
      {initialsFor(name)}
    </Text>
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
    <View
      accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'}
      accessibilityRole={type === 'error' ? 'alert' : undefined}
      accessible
      style={[styles.banner, { backgroundColor: background, borderColor, borderWidth: 1 }]}
    >
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
};

export const FieldLabel = ({ children, style }: { children: React.ReactNode, style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.label, style as any]}>{children}</Text>
);

export const Input = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={palette.subtle}
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
  accessibilityLabel,
  accessibilityHint,
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
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel || title || undefined}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading, disabled: !!disabled || !!loading }}
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

export const ListState = ({
  loading,
  error,
  emptyTitle,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: string;
  emptyTitle: string;
  emptyText: string;
  onRetry: () => void;
}) => (
  <View
    accessibilityLiveRegion={error ? 'assertive' : 'polite'}
    accessibilityRole={error ? 'alert' : undefined}
    style={styles.listState}
  >
    {loading ? (
      <>
        <ActivityIndicator color={palette.primary} />
        <Text style={styles.listStateTitle}>Loading…</Text>
      </>
    ) : error ? (
      <>
        <Text style={[styles.listStateTitle, styles.listStateErrorTitle]}>Couldn’t load this list</Text>
        <Text style={styles.listStateText}>{error}</Text>
        <Button title="Try again" size="small" variant="secondary" onPress={onRetry} />
      </>
    ) : (
      <>
        <Text style={styles.listStateTitle}>{emptyTitle}</Text>
        <Text style={styles.listStateText}>{emptyText}</Text>
      </>
    )}
  </View>
);

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
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  cardHeading: {
    gap: 4,
  },
  cardTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0,
  },
  screenHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  screenHeaderCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  screenTitle: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  segments: {
    backgroundColor: '#ECE5D9',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 8,
  },
  segmentSelected: {
    backgroundColor: palette.raised,
  },
  segmentText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentCount: {
    color: palette.subtle,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    justifyContent: 'center',
  },
  avatarMuted: {
    backgroundColor: '#ECE5D9',
  },
  avatarText: {
    color: palette.primary,
    fontWeight: '800',
  },
  cardBody: {
    gap: 12,
  },
  banner: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.field,
    borderRadius: 10,
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
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  buttonSizeSmall: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  buttonSizeIcon: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
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
  listState: {
    alignItems: 'center',
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  listStateTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  listStateErrorTitle: {
    color: palette.danger,
  },
  listStateText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 340,
    textAlign: 'center',
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

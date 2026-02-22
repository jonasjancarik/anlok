import React from 'react';
import {
  ActivityIndicator,
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

const palette = {
  canvas: '#f4f7ff',
  card: '#ffffff',
  border: '#d2dbf0',
  text: '#0f172a',
  muted: '#475569',
  primary: '#1d4ed8',
  danger: '#b91c1c',
  success: '#047857',
  warning: '#b45309',
};

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}

export const Screen = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.screen}>{children}</View>
);

export const PageScroll = ({ children }: { children: React.ReactNode }) => (
  <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
);

export const SectionCard = ({ children, title }: { children: React.ReactNode; title: string }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
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
    type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#dbeafe';
  const color =
    type === 'error' ? palette.danger : type === 'success' ? palette.success : palette.primary;

  return (
    <View style={[styles.banner, { backgroundColor: background }]}>
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
};

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Input = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor="#64748b"
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
  style,
}: ButtonProps) => {
  const variantStyles = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    danger: styles.buttonDanger,
    ghost: styles.buttonGhost,
  }[variant];

  const variantTextStyles = {
    primary: styles.buttonPrimaryText,
    secondary: styles.buttonSecondaryText,
    danger: styles.buttonDangerText,
    ghost: styles.buttonGhostText,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyles,
        pressed ? styles.buttonPressed : null,
        disabled || loading ? styles.buttonDisabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? palette.primary : '#ffffff'} />
      ) : (
        <Text style={[styles.buttonText, variantTextStyles]}>{title}</Text>
      )}
    </Pressable>
  );
};

export const Horizontal = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.horizontal}>{children}</View>
);

export const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.row}>{children}</View>
);

export const SubtleText = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.subtleText}>{children}</Text>
);

export const Divider = () => <View style={styles.divider} />;

export const Chip = ({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'success' | 'danger';
}) => {
  const color =
    tone === 'success' ? '#065f46' : tone === 'danger' ? '#991b1b' : '#1e3a8a';
  const background =
    tone === 'success' ? '#d1fae5' : tone === 'danger' ? '#fee2e2' : '#dbeafe';

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
    gap: 12,
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 17,
  },
  cardBody: {
    gap: 8,
  },
  banner: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
  },
  buttonSecondary: {
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  buttonDanger: {
    backgroundColor: palette.danger,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  buttonPrimaryText: {
    color: '#ffffff',
  },
  buttonSecondaryText: {
    color: '#0f172a',
  },
  buttonDangerText: {
    color: '#ffffff',
  },
  buttonGhostText: {
    color: '#0f172a',
  },
  horizontal: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  subtleText: {
    color: palette.muted,
    fontSize: 13,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    marginVertical: 4,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

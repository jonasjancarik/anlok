import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { api, apiErrorMessage, authHeaders, isDemoApiUrl } from '../lib/api';
import { APP_SUBTITLE, APP_TITLE } from '../lib/config';
import { Screen, palette, shadows } from '../components/common/ui';

const COOLDOWN_SECONDS = 10;
const UNLOCK_RING_STROKE_WIDTH = 6;
const UNLOCK_RING_GAP = 14;
const MINIMAL_RING_STROKE_WIDTH = 4;
const MINIMAL_BUTTON_BACKGROUND = '#FFFDF4';
const MINIMAL_RING_COLOR = '#343434';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type UnlockState = 'ready' | 'unlocking' | 'commandSent' | 'failed';

const statusCopy: Record<UnlockState, string> = {
  ready: 'Tap the button to open the door',
  unlocking: 'Sending unlock command…',
  commandSent: 'Unlock command sent. The door may take a moment to respond.',
  failed: 'Couldn’t send unlock command.',
};

const firstName = (name?: string) => name?.trim().split(/\s+/)[0] ?? '';

export const UnlockScreen = () => {
  const { token, user } = useAuth();
  const { apiUrl } = useServerConfig();
  const { unlockButtonStyle } = usePreferences();
  const minimal = unlockButtonStyle === 'minimal';
  const { height, width } = useWindowDimensions();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [unlockState, setUnlockState] = useState<UnlockState>('ready');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handledUnlockUrlRef = useRef<string | null>(null);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const unlockRingAnim = useMemo(() => new Animated.Value(0), []);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageSize = useMemo(() => {
    const availableSize = Math.max(200, Math.min(width - 48, height * 0.44));
    return Math.min(330, availableSize);
  }, [height, width]);
  const unlockSize = minimal ? stageSize : stageSize - UNLOCK_RING_GAP * 2;
  const ringStrokeWidth = minimal ? MINIMAL_RING_STROKE_WIDTH : UNLOCK_RING_STROKE_WIDTH;
  const ringRadius = (stageSize - ringStrokeWidth) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  // Green: the ring fills up during the cooldown. Minimal: the full ring drains away.
  const ringDashOffset = unlockRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: minimal ? [0, ringCircumference] : [ringCircumference, 0],
  });

  const cooldownLeft = useMemo(() => {
    if (!cooldownUntil) {
      return 0;
    }
    return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  }, [cooldownUntil, now]);

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const announce = useCallback((message: string) => {
    try {
      AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // Keep the unlock action available if a platform cannot announce status.
    }
  }, []);

  const resetUnlockAnimation = useCallback(() => {
    clearResetTimeout();
    unlockRingAnim.stopAnimation();
    unlockRingAnim.setValue(0);
    setCooldownUntil(null);
  }, [clearResetTimeout, unlockRingAnim]);

  useEffect(() => {
    return () => {
      clearResetTimeout();
      unlockRingAnim.stopAnimation();
    };
  }, [clearResetTimeout, unlockRingAnim]);

  const startCooldown = useCallback(() => {
    clearResetTimeout();
    unlockRingAnim.stopAnimation();
    unlockRingAnim.setValue(0);
    setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);

    Animated.timing(unlockRingAnim, {
      toValue: 1,
      duration: COOLDOWN_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        unlockRingAnim.setValue(0);
      }
    });

    resetTimeoutRef.current = setTimeout(() => {
      setCooldownUntil(null);
      setUnlockState('ready');
      unlockRingAnim.setValue(0);
      resetTimeoutRef.current = null;
    }, COOLDOWN_SECONDS * 1000);
  }, [clearResetTimeout, unlockRingAnim]);

  const unlockDoor = useCallback(async () => {
    if (!token || loading || cooldownLeft > 0) {
      return;
    }

    setLoading(true);
    setError('');
    setUnlockState('unlocking');
    announce(statusCopy.unlocking);

    try {
      await api.post('/doors/unlock', null, { headers: authHeaders(token) });
      setUnlockState('commandSent');
      startCooldown();
      announce(statusCopy.commandSent);
    } catch (nextError) {
      resetUnlockAnimation();
      const message = apiErrorMessage(nextError, 'Failed to send unlock command.');
      setError(message);
      setUnlockState('failed');
      announce(`${statusCopy.failed} ${message}`);
    } finally {
      setLoading(false);
    }
  }, [announce, cooldownLeft, loading, resetUnlockAnimation, startCooldown, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const requestUnlockConfirmation = (url: string | null) => {
      if (!url || url === handledUnlockUrlRef.current) {
        return;
      }
      const { queryParams } = Linking.parse(url);
      if (queryParams?.['unlock-now'] === undefined) {
        return;
      }
      handledUnlockUrlRef.current = url;

      Alert.alert(
        'Send unlock command?',
        'This link asks Anlok to send an unlock command to the door. The app cannot confirm that the door physically opened.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send command', onPress: () => void unlockDoor() },
        ]
      );
    };

    void Linking.getInitialURL().then((url) => {
      requestUnlockConfirmation(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      requestUnlockConfirmation(url);
    });

    return () => subscription.remove();
  }, [token, unlockDoor]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const unlockDisabled = !token || cooldownLeft > 0 || loading;
  const sent = cooldownLeft > 0;
  const unlockLabel = minimal
    ? loading ? 'Unlocking…' : sent ? 'Command sent' : 'Unlock Door'
    : loading ? 'Unlocking…' : sent ? 'Sent' : 'Unlock';
  const unlockIcon: keyof typeof Feather.glyphMap = sent ? 'check' : unlockState === 'failed' ? 'rotate-cw' : 'unlock';
  const unavailable = !token;
  const name = firstName(user?.name);
  const apartment = user?.apartment?.number;
  const statusTone = unlockState === 'failed' ? 'error' : sent ? 'success' : 'neutral';

  const progressRing = (
    <Svg
      pointerEvents="none"
      height={stageSize}
      style={[screenStyles.progressCircle, { transform: [{ rotate: '-90deg' }] }]}
      viewBox={`0 0 ${stageSize} ${stageSize}`}
      width={stageSize}
    >
      <AnimatedCircle
        cx={stageSize / 2}
        cy={stageSize / 2}
        fill="none"
        opacity={minimal || sent ? 1 : 0}
        r={ringRadius}
        stroke={minimal ? MINIMAL_RING_COLOR : palette.primary}
        strokeDasharray={ringCircumference}
        strokeDashoffset={ringDashOffset as any}
        strokeLinecap={minimal ? 'butt' : 'round'}
        strokeWidth={ringStrokeWidth}
      />
    </Svg>
  );

  return (
    <Screen>
      <View style={screenStyles.shell}>
        <View style={screenStyles.header}>
          <View style={screenStyles.brandRow}>
            <View style={screenStyles.brandMark}>
              <Feather name="lock" size={14} color={palette.primary} />
            </View>
            <Text style={screenStyles.brand}>{APP_TITLE}</Text>
          </View>
          <Text accessibilityRole="header" style={screenStyles.greeting}>
            {name ? `Hi, ${name}` : 'Welcome'}
          </Text>
          <Text style={screenStyles.subtitle}>
            {[APP_SUBTITLE, apartment ? `Apartment ${apartment}` : null].filter(Boolean).join(' · ')}
          </Text>
          {isDemoApiUrl(apiUrl) ? (
            <View style={screenStyles.demoPill}>
              <Text style={screenStyles.demoPillText}>Demo · sample data, no real door</Text>
            </View>
          ) : null}
        </View>

        <View style={[screenStyles.stage, { height: stageSize, width: stageSize }]}>
          {minimal ? null : (
            <View
              pointerEvents="none"
              style={[
                screenStyles.track,
                { borderRadius: stageSize / 2, height: stageSize, width: stageSize },
              ]}
            />
          )}
          {minimal ? null : progressRing}
          <Animated.View
            style={[
              { borderRadius: unlockSize / 2, height: unlockSize, transform: [{ scale: scaleAnim }], width: unlockSize },
              minimal ? [screenStyles.minimalButtonShadow, shadows] : screenStyles.buttonShadow,
            ]}
          >
            <Pressable
              accessibilityHint={
                unlockDisabled
                  ? loading
                    ? 'An unlock command is being sent.'
                    : cooldownLeft > 0
                      ? `You can send another unlock command in ${cooldownLeft} seconds.`
                      : 'Sign in to send an unlock command.'
                  : 'Sends an unlock command to the door. This does not confirm the door physically opened.'
              }
              accessibilityLabel="Unlock door"
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: unlockDisabled }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={unlockDoor}
              disabled={unlockDisabled}
              style={({ pressed }) => [
                screenStyles.unlockButton,
                { borderRadius: unlockSize / 2, height: unlockSize, width: unlockSize },
                minimal ? screenStyles.minimalButton : sent ? screenStyles.unlockButtonSent : null,
                unavailable ? screenStyles.unlockButtonUnavailable : null,
                pressed ? (minimal ? screenStyles.minimalButtonPressed : screenStyles.unlockButtonPressed) : null,
              ]}
            >
              {minimal ? null : (
                <Feather name={unlockIcon} size={Math.round(unlockSize * 0.2)} color="#fff" />
              )}
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={minimal ? 2 : 1}
                style={[screenStyles.unlockButtonText, minimal ? screenStyles.minimalButtonText : null]}
              >
                {unlockLabel}
              </Text>
              {sent && !minimal ? (
                <Text style={screenStyles.cooldownText}>Ready again in {cooldownLeft}s</Text>
              ) : null}
            </Pressable>
          </Animated.View>
          {minimal ? progressRing : null}
        </View>

        <View style={screenStyles.statusArea}>
          <View
            style={[
              screenStyles.statusPill,
              statusTone === 'success' ? screenStyles.statusPillSuccess : null,
              statusTone === 'error' ? screenStyles.statusPillError : null,
            ]}
          >
            {statusTone !== 'neutral' ? (
              <Feather
                name={statusTone === 'success' ? 'check-circle' : 'alert-circle'}
                size={16}
                color={statusTone === 'success' ? palette.success : palette.danger}
              />
            ) : null}
            <Text
              accessibilityLiveRegion="polite"
              style={[
                screenStyles.statusText,
                statusTone === 'success' ? { color: palette.success } : null,
                statusTone === 'error' ? { color: palette.danger } : null,
              ]}
            >
              {statusCopy[unlockState]}
            </Text>
          </View>
          {error ? (
            <Text accessibilityLiveRegion="assertive" style={screenStyles.errorText}>{error}</Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-evenly',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  demoPill: {
    backgroundColor: palette.primarySoft,
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  demoPillText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  brand: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  greeting: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    backgroundColor: palette.primarySoft,
    left: 0,
    opacity: 0.6,
    position: 'absolute',
    top: 0,
  },
  buttonShadow: {
    backgroundColor: palette.primary,
    ...Platform.select({
      ios: {
        shadowColor: palette.primaryActive,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0 18px 40px rgba(16, 82, 63, 0.28)' as any },
    }),
  },
  unlockButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    gap: 6,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 28,
  },
  minimalButtonShadow: {
    backgroundColor: MINIMAL_BUTTON_BACKGROUND,
  },
  minimalButton: {
    backgroundColor: MINIMAL_BUTTON_BACKGROUND,
  },
  minimalButtonPressed: {
    opacity: 0.82,
  },
  minimalButtonText: {
    color: '#000',
  },
  unlockButtonSent: {
    backgroundColor: palette.primaryActive,
  },
  unlockButtonPressed: {
    backgroundColor: palette.primaryActive,
  },
  unlockButtonUnavailable: {
    opacity: 0.48,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 36,
    textAlign: 'center',
  },
  cooldownText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  progressCircle: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  statusArea: {
    alignItems: 'center',
    gap: 10,
    minHeight: 96,
    paddingHorizontal: 12,
  },
  statusPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: 360,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusPillSuccess: {
    backgroundColor: '#E5F1EA',
    borderRadius: 12,
  },
  statusPillError: {
    backgroundColor: '#F8E8E4',
    borderRadius: 12,
  },
  statusText: {
    color: palette.muted,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    maxWidth: 360,
    textAlign: 'center',
  },
});

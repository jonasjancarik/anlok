import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { APP_SUBTITLE } from '../lib/config';
import { Screen, palette, shadows, styles as uiStyles } from '../components/common/ui';

const COOLDOWN_SECONDS = 10;
const UNLOCK_RING_STROKE_WIDTH = 4;
const UNLOCK_BUTTON_BACKGROUND = '#FFFDF4';
const UNLOCK_RING_COLOR = '#343434';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const UnlockScreen = () => {
  const { token } = useAuth();
  const { height, width } = useWindowDimensions();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState('Ready to unlock');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [handledAutoUnlockUrl, setHandledAutoUnlockUrl] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const unlockRingAnim = useRef(new Animated.Value(0)).current;
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlockSize = useMemo(() => {
    const availableSize = Math.max(180, Math.min(width - 48, height * 0.42));
    return Math.min(320, availableSize);
  }, [height, width]);
  const ringRadius = (unlockSize - UNLOCK_RING_STROKE_WIDTH) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = unlockRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ringCircumference],
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

  const startUnlockAnimation = useCallback(() => {
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
      setStatus('Ready to unlock');
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
    setStatus('Unlocked...');
    startUnlockAnimation();

    try {
      await api.post('/doors/unlock', null, { headers: authHeaders(token) });
      setStatus('Door unlocked successfully.');
    } catch (nextError) {
      resetUnlockAnimation();
      setError(apiErrorMessage(nextError, 'Failed to unlock door.'));
      setStatus('Ready to unlock');
    } finally {
      setLoading(false);
    }
  }, [cooldownLeft, loading, resetUnlockAnimation, startUnlockAnimation, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const maybeAutoUnlock = (url: string | null) => {
      if (!url || url === handledAutoUnlockUrl) {
        return;
      }
      const { queryParams } = Linking.parse(url);
      if (queryParams?.['unlock-now'] === undefined) {
        return;
      }
      setHandledAutoUnlockUrl(url);
      void unlockDoor();
    };

    void Linking.getInitialURL().then((url) => {
      maybeAutoUnlock(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      maybeAutoUnlock(url);
    });

    return () => subscription.remove();
  }, [handledAutoUnlockUrl, token, unlockDoor]);

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
  const unlockLabel = cooldownLeft > 0 || loading ? 'Unlocked...' : 'Unlock Door';
  const unavailable = !token;

  return (
    <Screen>
      <View style={screenStyles.shell}>
        <View style={screenStyles.header}>
          <Text style={screenStyles.brand}>Anlok</Text>
          <Text style={screenStyles.subtitle}>{APP_SUBTITLE}</Text>
        </View>

        <View style={[screenStyles.stage, { height: unlockSize, width: unlockSize }]}>
          <Animated.View style={[screenStyles.buttonShadow, { borderRadius: unlockSize / 2, height: unlockSize, transform: [{ scale: scaleAnim }], width: unlockSize }, shadows]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: unlockDisabled }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={unlockDoor}
              disabled={unlockDisabled}
              style={({ pressed }) => [
                screenStyles.unlockButton,
                { borderRadius: unlockSize / 2, height: unlockSize, width: unlockSize },
                unavailable ? screenStyles.unlockButtonUnavailable : null,
                pressed ? screenStyles.unlockButtonPressed : null,
              ]}
            >
              <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={2} style={screenStyles.unlockButtonText}>
                {unlockLabel}
              </Text>
            </Pressable>
          </Animated.View>
          <Svg
            pointerEvents="none"
            height={unlockSize}
            style={[
              screenStyles.progressCircle,
              { transform: [{ rotate: '-90deg' }] },
            ]}
            viewBox={`0 0 ${unlockSize} ${unlockSize}`}
            width={unlockSize}
          >
            <AnimatedCircle
              cx={unlockSize / 2}
              cy={unlockSize / 2}
              fill="none"
              r={ringRadius}
              stroke={UNLOCK_RING_COLOR}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringDashOffset as any}
              strokeWidth={UNLOCK_RING_STROKE_WIDTH}
            />
          </Svg>
        </View>

        <View style={screenStyles.statusArea}>
          <Text style={[uiStyles.subtleText, screenStyles.statusText]}>{status}</Text>
          {error ? (
            <View style={screenStyles.errorPanel}>
              <Text style={screenStyles.errorText}>{error}</Text>
            </View>
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
    justifyContent: 'center',
    padding: 20,
  },
  brand: {
    color: palette.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 74,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonShadow: {
    backgroundColor: UNLOCK_BUTTON_BACKGROUND,
  },
  unlockButton: {
    alignItems: 'center',
    backgroundColor: UNLOCK_BUTTON_BACKGROUND,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 28,
  },
  unlockButtonPressed: {
    opacity: 0.82,
  },
  unlockButtonUnavailable: {
    opacity: 0.48,
  },
  unlockButtonText: {
    color: '#000',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 36,
    textAlign: 'center',
  },
  progressCircle: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  statusArea: {
    alignItems: 'center',
    height: 88,
    marginTop: 52,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorPanel: {
    backgroundColor: '#F8E8E4',
    borderColor: '#E5B7AF',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});

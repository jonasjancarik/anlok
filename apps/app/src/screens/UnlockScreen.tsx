import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { APP_SUBTITLE } from '../lib/config';
import { Screen, palette, shadows, styles as uiStyles } from '../components/common/ui';

const COOLDOWN_SECONDS = 10;

export const UnlockScreen = () => {
  const { token } = useAuth();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState('Ready to unlock');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [handledAutoUnlockUrl, setHandledAutoUnlockUrl] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  const unlockDoor = useCallback(async () => {
    if (!token || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Unlocking...');

    try {
      await api.post('/doors/unlock', null, { headers: authHeaders(token) });
      setStatus('Door unlocked successfully.');
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      setTimeout(() => {
        setCooldownUntil(null);
        setStatus('Ready to unlock');
      }, COOLDOWN_SECONDS * 1000);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to unlock door.'));
      setStatus('Ready to unlock');
    } finally {
      setLoading(false);
    }
  }, [loading, token]);

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
  const unlockLabel = loading ? 'Unlocking...' : cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Unlock';

  useEffect(() => {
    if (unlockDisabled) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim, unlockDisabled]);

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.42],
  });
  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.24, 0.08, 0],
  });

  return (
    <Screen>
      <View style={screenStyles.shell}>
        <View style={screenStyles.header}>
          <Text style={screenStyles.brand}>Anlok</Text>
          <Text style={screenStyles.subtitle}>{APP_SUBTITLE}</Text>
        </View>

        <View style={screenStyles.stage}>
          <Animated.View
            pointerEvents="none"
            style={[
              screenStyles.pulseRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View style={[screenStyles.buttonShadow, { transform: [{ scale: scaleAnim }] }, shadows]}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={unlockDoor}
              disabled={unlockDisabled}
              style={({ pressed }) => [
                screenStyles.unlockButton,
                unlockDisabled ? screenStyles.unlockButtonDisabled : null,
                pressed ? screenStyles.unlockButtonPressed : null,
              ]}
            >
              <Feather name={loading ? 'loader' : cooldownLeft > 0 ? 'clock' : 'unlock'} size={62} color="#fff" />
              <Text style={screenStyles.unlockButtonText}>{unlockLabel}</Text>
            </Pressable>
          </Animated.View>
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
    height: 250,
    justifyContent: 'center',
    width: 250,
  },
  pulseRing: {
    backgroundColor: palette.primarySoft,
    borderColor: '#BFD7CA',
    borderRadius: 125,
    borderWidth: 1,
    height: 250,
    position: 'absolute',
    width: 250,
  },
  buttonShadow: {
    borderRadius: 110,
    height: 220,
    width: 220,
  },
  unlockButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: '#BFD7CA',
    borderRadius: 110,
    borderWidth: 10,
    height: 220,
    justifyContent: 'center',
    width: 220,
  },
  unlockButtonPressed: {
    backgroundColor: palette.primaryActive,
  },
  unlockButtonDisabled: {
    backgroundColor: palette.subtle,
    borderColor: '#D6CEC2',
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
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

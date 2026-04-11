import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
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
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 80 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: palette.text, marginBottom: 8, letterSpacing: -1 }}>Anlok</Text>
          <Text style={{ fontSize: 16, color: palette.muted, textAlign: 'center', fontWeight: '500' }}>{APP_SUBTITLE}</Text>
        </View>

        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, shadows]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={unlockDoor}
            disabled={!token || cooldownLeft > 0 || loading}
            style={({ pressed }) => [
              {
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: cooldownLeft > 0 ? palette.muted : loading ? palette.primaryActive : palette.primary,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
                borderWidth: 8,
                borderColor: cooldownLeft > 0 ? '#CBD5E1' : loading ? '#3730A3' : '#E0E7FF',
              }
            ]}
          >
            <Feather 
              name={loading ? "loader" : cooldownLeft > 0 ? "clock" : "unlock"} 
              size={64} 
              color="#ffffff" 
            />
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 12, letterSpacing: 0.5 }}>
              {loading ? 'Unlocking...' : cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Unlock'}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={{ marginTop: 60, alignItems: 'center', height: 80, paddingHorizontal: 20 }}>
          <Text style={[uiStyles.subtleText, { fontSize: 16, fontWeight: '600' }]}>{status}</Text>
          {error ? (
            <View style={{ marginTop: 12, backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ color: palette.danger, fontWeight: '600', textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { api, apiErrorMessage, authHeaders } from '../lib/api';
import { APP_SUBTITLE } from '../lib/config';
import { Banner, Button, PageScroll, Screen, SectionCard, styles as uiStyles } from '../components/common/ui';

const COOLDOWN_SECONDS = 10;

export const UnlockScreen = () => {
  const { token } = useAuth();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const unlockDoor = async () => {
    if (!token || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Unlocking...');

    try {
      await api.post('/doors/unlock', null, { headers: authHeaders(token) });
      setStatus('Door unlock requested.');
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      setTimeout(() => {
        setCooldownUntil(null);
      }, COOLDOWN_SECONDS * 1000);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to unlock door.'));
      setStatus('Ready');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <PageScroll>
        <SectionCard title="Door">
          <Text style={[uiStyles.subtleText, { fontSize: 15 }]}>{APP_SUBTITLE}</Text>
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 18,
              gap: 8,
            }}
          >
            <Button
              title={cooldownLeft > 0 ? `Wait ${cooldownLeft}s` : 'Unlock Door'}
              onPress={unlockDoor}
              loading={loading}
              disabled={!token || cooldownLeft > 0}
              style={{ minWidth: 220 }}
            />
            <Text style={uiStyles.subtleText}>Status: {status}</Text>
          </View>
          {error ? <Banner type="error" text={error} /> : null}
        </SectionCard>
      </PageScroll>
    </Screen>
  );
};

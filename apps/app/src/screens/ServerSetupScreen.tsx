import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles, palette } from '../components/common/ui';
import { api, authHeaders, isSupportedApiUrl, normalizeApiUrl } from '../lib/api';
import { DEMO_API_URL, DEMO_TOKEN } from '../lib/demo/demoServer';
import { User } from '../types/entities';

export const ServerSetupScreen = () => {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const { apiUrl, suggestedApiUrl, saveApiUrl } = useServerConfig();
  const [draftUrl, setDraftUrl] = useState(() => apiUrl || suggestedApiUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  const validationError = useMemo(() => {
    const trimmed = draftUrl.trim();

    if (!trimmed) {
      return 'Enter the server URL.';
    }

    if (!isSupportedApiUrl(trimmed)) {
      return 'Enter a valid server host or URL.';
    }

    return '';
  }, [draftUrl]);

  const normalizedUrl = useMemo(() => {
    if (validationError || !draftUrl.trim()) {
      return '';
    }

    return normalizeApiUrl(draftUrl);
  }, [draftUrl, validationError]);

  const save = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    setConnectionStatus('');

    try {
      const response = await axios.get<{ status?: string }>(`${normalizedUrl}/health`, {
        timeout: 8000,
      });

      if (response.data?.status !== 'ok') {
        setError('This server responded, but it doesn’t appear to be an Anlok server.');
        return;
      }

      setConnectionStatus(`Connected to ${normalizedUrl}.`);
      await saveApiUrl(draftUrl);
      const serverChanged = normalizedUrl !== apiUrl;

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }

      if (serverChanged && user) {
        await logout();
      }
    } catch (nextError) {
      if (axios.isAxiosError(nextError) && nextError.code === 'ECONNABORTED') {
        setError('The server took too long to respond. Check the address and your connection, then try again.');
      } else if (axios.isAxiosError(nextError) && nextError.response) {
        setError(`The server responded with status ${nextError.response.status}, but Anlok couldn’t connect.`);
      } else {
        setError('Couldn’t reach this server. Check the address, certificate, and your Wi-Fi, then try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const startDemo = async () => {
    setSaving(true);
    setError('');
    setConnectionStatus('');

    try {
      await saveApiUrl(DEMO_API_URL);
      const response = await api.post<{ user: User }>('/auth/verify', {}, { headers: authHeaders(DEMO_TOKEN) });
      await login(DEMO_TOKEN, response.data.user);

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageScroll>
        <View style={screenStyles.shell}>
          <View style={screenStyles.hero}>
            <View style={screenStyles.mark}>
              <Feather name="server" size={28} color="#fff" />
            </View>
            <Text style={screenStyles.title}>Server setup</Text>
            <Text style={screenStyles.subtitle}>Connect this device to your building&apos;s door server.</Text>
          </View>

          <SectionCard title="Connection">
            <Text style={[uiStyles.subtleText, screenStyles.helper]}>
              Enter the address of the Anlok server this device should use.
            </Text>

            {user ? (
              <Banner
                type="info"
                text="Changing to another server will sign you out on this device."
              />
            ) : null}

            <View style={{ gap: 8, marginBottom: 8 }}>
              <FieldLabel>Server URL</FieldLabel>
              <Input
                accessibilityLabel="Server URL"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                nativeID="server-url"
                onChangeText={setDraftUrl}
                placeholder="door-api.example.com"
                value={draftUrl}
              />
              <Text style={[uiStyles.subtleText, { fontSize: 13, marginTop: 4 }]}>
                Examples: door-api.example.com, https://demo.example.com, 10.0.2.2:8000
              </Text>
              {normalizedUrl ? (
                <Text style={[uiStyles.subtleText, { fontSize: 13 }]}>Will connect to {normalizedUrl}</Text>
              ) : null}
            </View>

            {error ? <Banner type="error" text={error} /> : null}
            {connectionStatus ? <Banner type="success" text={connectionStatus} /> : null}

            <Button
              title="Test and continue"
              onPress={() => void save()}
              loading={saving}
              disabled={!!validationError}
              accessibilityHint="Checks this server before saving it"
              icon={<Feather name="wifi" size={18} color="#fff" />}
              style={{ marginTop: 12 }}
            />
          </SectionCard>

          <SectionCard title="No server yet?">
            <Text style={[uiStyles.subtleText, screenStyles.helper]}>
              Try Anlok with sample data. It isn&apos;t connected to a real door, and nothing you change is saved.
            </Text>
            <Button
              title="Try the demo"
              variant="secondary"
              onPress={() => void startDemo()}
              disabled={saving}
              accessibilityHint="Opens the app with sample data instead of a real server"
              icon={<Feather name="play-circle" size={18} color={palette.primary} />}
              style={{ marginTop: 12 }}
            />
          </SectionCard>
        </View>
      </PageScroll>
    </Screen>
  );
};

const screenStyles = StyleSheet.create({
  shell: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 520,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 48,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 20,
    height: 64,
    justifyContent: 'center',
    marginBottom: 8,
    width: 64,
  },
  title: {
    color: palette.text,
    fontSize: 31,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  helper: {
    backgroundColor: palette.field,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 8,
    padding: 14,
    textAlign: 'center',
  },
});

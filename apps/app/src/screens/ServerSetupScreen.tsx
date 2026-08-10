import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { Feather } from '@expo/vector-icons';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles, palette } from '../components/common/ui';
import { isSupportedApiUrl, normalizeApiUrl } from '../lib/api';

export const ServerSetupScreen = () => {
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

  return (
    <Screen>
      <PageScroll>
        <View style={screenStyles.shell}>
          <View style={screenStyles.hero}>
            <View style={screenStyles.mark}>
              <Feather name="server" size={30} color={palette.primary} />
            </View>
            <Text style={screenStyles.title}>Server setup</Text>
            <Text style={screenStyles.subtitle}>Connect this device to your Anlok backend.</Text>
          </View>

          <SectionCard title="Connection">
            <Text style={[uiStyles.subtleText, screenStyles.helper]}>
              Enter the Anlok server URL before login.
            </Text>

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
    backgroundColor: palette.primarySoft,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: 1,
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

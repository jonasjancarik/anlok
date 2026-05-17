import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles, palette } from '../components/common/ui';

const isValidServerUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const ServerSetupScreen = () => {
  const { apiUrl, suggestedApiUrl, saveApiUrl } = useServerConfig();
  const [draftUrl, setDraftUrl] = useState(() => apiUrl || suggestedApiUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const validationError = useMemo(() => {
    const trimmed = draftUrl.trim();

    if (!trimmed) {
      return 'Enter the server URL.';
    }

    if (!isValidServerUrl(trimmed)) {
      return 'Use a full http:// or https:// URL.';
    }

    return '';
  }, [draftUrl]);

  const save = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await saveApiUrl(draftUrl);
    } catch {
      setError('Failed to save server URL.');
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
                placeholder="https://anlok.example.com"
                value={draftUrl}
              />
              <Text style={[uiStyles.subtleText, { fontSize: 13, marginTop: 4 }]}>
                Examples: https://demo.example.com, http://10.0.2.2:8000
              </Text>
            </View>

            {error ? <Banner type="error" text={error} /> : null}

            <Button
              title="Continue"
              onPress={() => void save()}
              loading={saving}
              icon={<Feather name="arrow-right" size={18} color="#fff" />}
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

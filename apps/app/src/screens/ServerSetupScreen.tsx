import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { Banner, Button, FieldLabel, Input, PageScroll, Screen, SectionCard, styles as uiStyles } from '../components/common/ui';

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
        <SectionCard title="Connect to Server">
          <Text style={[uiStyles.subtleText, { fontSize: 15 }]}>
            Enter the Anlok server URL before login.
          </Text>
          <View style={{ gap: 6 }}>
            <FieldLabel>Server URL</FieldLabel>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={draftUrl}
              onChangeText={setDraftUrl}
              placeholder="https://anlok.example.com"
            />
          </View>
          <Text style={uiStyles.subtleText}>
            Include protocol. Examples: `https://demo.example.com`, `http://10.0.2.2:8000`.
          </Text>
          {error ? <Banner type="error" text={error} /> : null}
          <Button title="Continue" onPress={() => void save()} loading={saving} />
        </SectionCard>
      </PageScroll>
    </Screen>
  );
};

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
        <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Feather name="server" size={36} color={palette.primary} />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text }}>Server Setup</Text>
        </View>

        <SectionCard>
          <Text style={[uiStyles.subtleText, { fontSize: 16, textAlign: 'center', marginBottom: 16 }]}>
            Enter the Anlok server URL before login.
          </Text>

          <View style={{ gap: 8, marginBottom: 8 }}>
            <FieldLabel>Server URL</FieldLabel>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={draftUrl}
              onChangeText={setDraftUrl}
              placeholder="https://anlok.example.com"
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
      </PageScroll>
    </Screen>
  );
};

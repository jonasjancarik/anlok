import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { ApiKey } from '../../types/entities';
import {
  Banner,
  Button,
  Chip,
  Divider,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
  palette,
} from '../common/ui';

interface ApiKeyManagementProps {
  token: string;
  userId: number;
}

export const ApiKeyManagement = ({ token, userId }: ApiKeyManagementProps) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [description, setDescription] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiKey[]>('/api-keys', {
        headers: authHeaders(token),
      });
      setApiKeys(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to load API keys.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const createKey = async () => {
    setError('');
    setSuccess('');
    setNewKey(null);

    try {
      const response = await api.post<ApiKey>(
        '/api-keys',
        {
          description: description.trim(),
          user_id: userId,
        },
        { headers: authHeaders(token) }
      );

      setNewKey(response.data.api_key ?? null);
      setDescription('');
      setSuccess('API key created. Copy now; full key shown once.');
      await loadKeys();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to create API key.'));
    }
  };

  const deleteKey = (keySuffix: string) => {
    Alert.alert('Delete API key', `Delete key ending ${keySuffix}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setSuccess('');
          try {
            await api.delete(`/api-keys/${keySuffix}`, {
              headers: authHeaders(token),
            });
            setSuccess('API key deleted.');
            await loadKeys();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete API key.'));
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title="API Keys">
      <View style={{ gap: 6 }}>
        <FieldLabel>New Key Description</FieldLabel>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Home Assistant integration"
        />
      </View>
      <Button
        title="Create API Key"
        size="small"
        icon={<Feather name="plus" size={14} color="#fff" />}
        onPress={createKey}
        disabled={!description.trim()}
        loading={loading}
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
      />

      {newKey ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.canvas,
            borderRadius: 10,
            padding: 16,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: '700', color: palette.text }}>Copy your API key now</Text>
          <SubtleText>The full key is only shown once after creation.</SubtleText>
          <Input value={newKey} editable={false} style={{ backgroundColor: '#fff' }} />
          <Button size="small" title="Dismiss" variant="secondary" onPress={() => setNewKey(null)} />
        </View>
      ) : null}
      
      {success && !newKey ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {apiKeys.length === 0 ? (
        <SubtleText>{loading ? 'Loading keys...' : 'No API keys configured.'}</SubtleText>
      ) : (
        <View style={{ gap: 0 }}>
          {apiKeys.map((apiKey, index) => (
            <View
              key={apiKey.key_suffix}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index === apiKeys.length - 1 ? 0 : 1,
                borderBottomColor: palette.canvas,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text }}>
                    ...{apiKey.key_suffix}
                  </Text>
                  <Chip text={apiKey.is_active ? 'Active' : 'Inactive'} tone={apiKey.is_active ? 'success' : 'danger'} />
                </View>
                <SubtleText style={{ fontSize: 13, marginBottom: 2 }}>{apiKey.description || 'No description'}</SubtleText>
                <SubtleText style={{ fontSize: 12 }}>Created: {new Date(apiKey.created_at).toLocaleDateString()}</SubtleText>
              </View>
              <Button
                size="icon"
                title=""
                variant="ghost"
                icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                onPress={() => deleteKey(apiKey.key_suffix)}
              />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};

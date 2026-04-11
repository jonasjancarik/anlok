import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
          placeholder="Door unlock integration"
        />
      </View>
      <Button
        title="Create API Key"
        onPress={createKey}
        disabled={!description.trim()}
        loading={loading}
      />

      {newKey ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#bfdbfe',
            backgroundColor: '#eff6ff',
            borderRadius: 10,
            padding: 10,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: '700', color: '#1e3a8a' }}>Copy your API key now</Text>
          <SubtleText>The full key is only shown once after creation.</SubtleText>
          <Input value={newKey} editable={false} />
          <Button title="Hide Full Key" variant="ghost" onPress={() => setNewKey(null)} />
        </View>
      ) : null}
      {success ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {apiKeys.length === 0 ? (
        <SubtleText>{loading ? 'Loading keys...' : 'No API keys.'}</SubtleText>
      ) : (
        <View style={{ gap: 8 }}>
          {apiKeys.map((apiKey) => (
            <View
              key={apiKey.key_suffix}
              style={{
                borderWidth: 1,
                borderColor: '#d2dbf0',
                borderRadius: 10,
                padding: 10,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: '700' }}>...{apiKey.key_suffix}</Text>
              <SubtleText>{apiKey.description || 'No description'}</SubtleText>
              <Chip text={apiKey.is_active ? 'Active' : 'Inactive'} tone={apiKey.is_active ? 'success' : 'danger'} />
              <SubtleText>
                Created: {new Date(apiKey.created_at).toLocaleString()}
              </SubtleText>
              <Button
                title="Delete"
                variant="danger"
                onPress={() => deleteKey(apiKey.key_suffix)}
              />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};

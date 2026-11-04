import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders, getApiBaseUrl } from '../../lib/api';
import { parseServerDate } from '../../lib/time';
import { ApiKey, ApiKeyScope } from '../../types/entities';
import {
  Banner,
  Button,
  Chip,
  Divider,
  FieldLabel,
  Input,
  ListState,
  SectionCard,
  SegmentedControl,
  SubtleText,
  palette,
} from '../common/ui';
import { UnlockShortcutGuide } from './UnlockShortcutGuide';

interface ApiKeyManagementProps {
  token: string;
  userId: number;
}

export const ApiKeyManagement = ({ token, userId }: ApiKeyManagementProps) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('unlock');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyScope>('unlock');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const response = await api.get<ApiKey[]>('/api-keys', {
        headers: authHeaders(token),
      });
      setApiKeys(response.data);
    } catch (nextError) {
      setListError(apiErrorMessage(nextError, 'Failed to load API keys.'));
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
          scope,
        },
        { headers: authHeaders(token) }
      );

      setNewKey(response.data.api_key ?? null);
      setNewKeyScope(response.data.scope ?? scope);
      setDescription('');
      setSuccess('API key created. Copy it now. You won’t be able to see it again.');
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
          placeholder="e.g. iPhone shortcut or Home Assistant"
        />
      </View>
      <View style={{ gap: 6 }}>
        <FieldLabel>What can this key do?</FieldLabel>
        <SegmentedControl<ApiKeyScope>
          options={[
            { key: 'unlock', label: 'Open door only', icon: 'unlock' },
            { key: 'full', label: 'Full access', icon: 'key' },
          ]}
          value={scope}
          onChange={setScope}
        />
        <SubtleText style={{ fontSize: 13 }}>
          {scope === 'unlock'
            ? 'Best for phone shortcuts, widgets and Home Assistant.'
            : 'The key can do anything you can do in Anlok, including managing PINs and keys. Use it only for services you fully trust.'}
        </SubtleText>
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
          <SubtleText>You won’t be able to see the full key again. Press and hold it to copy.</SubtleText>
          <Text
            selectable
            style={{
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: 8,
              padding: 12,
              color: palette.text,
              fontSize: 14,
            }}
          >
            {newKey}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              size="small"
              title="Share key"
              variant="secondary"
              icon={<Feather name="share" size={14} color={palette.text} />}
              onPress={() => void Share.share({ message: newKey })}
            />
            <Button size="small" title="Done" variant="secondary" onPress={() => setNewKey(null)} />
          </View>
          {newKeyScope === 'unlock' ? (
            <>
              <Divider />
              <UnlockShortcutGuide serverUrl={getApiBaseUrl()} apiKey={newKey} />
            </>
          ) : null}
        </View>
      ) : null}
      
      {success && !newKey ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}
      {listError && apiKeys.length > 0 ? <Banner type="error" text={listError} /> : null}

      <Divider />
      {apiKeys.length === 0 ? (
        <ListState
          loading={loading}
          error={listError}
          emptyTitle="No API keys"
          emptyText="Create a key to open the door from a phone shortcut, a widget or Home Assistant."
          onRetry={() => void loadKeys()}
        />
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
                  <Chip text={apiKey.scope === 'unlock' ? 'Opens door only' : 'Full access'} />
                </View>
                <SubtleText style={{ fontSize: 13, marginBottom: 2 }}>{apiKey.description || 'No description'}</SubtleText>
                <SubtleText style={{ fontSize: 12 }}>Created: {parseServerDate(apiKey.created_at).toLocaleDateString()}</SubtleText>
              </View>
              <Button
                size="icon"
                title=""
                accessibilityLabel={`Delete API key ending in ${apiKey.key_suffix}`}
                variant="ghost"
                icon={<Feather name="trash-2" size={16} color={palette.danger} />}
                onPress={() => deleteKey(apiKey.key_suffix)}
              />
            </View>
          ))}
        </View>
      )}

      {!newKey ? (
        <>
          <Divider />
          <UnlockShortcutGuide serverUrl={getApiBaseUrl()} />
        </>
      ) : null}
    </SectionCard>
  );
};

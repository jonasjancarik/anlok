import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { RFID, User } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  ListState,
  SectionCard,
  SubtleText,
  palette,
} from '../common/ui';

interface RfidManagementProps {
  token: string;
  user: User;
  canUseScanner: boolean;
}

export const RfidManagement = ({ token, user, canUseScanner }: RfidManagementProps) => {
  const [rfids, setRfids] = useState<RFID[]>([]);
  const [uuid, setUuid] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);

  const loadRfids = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<RFID[]>(`/users/${user.id}/rfids`, {
        headers: authHeaders(token),
      });
      setRfids(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to fetch RFIDs.'));
    } finally {
      setLoading(false);
    }
  }, [token, user.id]);

  useEffect(() => {
    loadRfids();
  }, [loadRfids]);

  const readTag = async () => {
    setReading(true);
    setError('');
    try {
      const response = await api.get<{ uuid: string }>('/rfids/read', {
        headers: authHeaders(token),
        params: { timeout: 30 },
      });
      setUuid(response.data.uuid);
      setSuccess('RFID tag read successfully.');
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to read RFID tag.'));
    } finally {
      setReading(false);
    }
  };

  const addRfid = async () => {
    setError('');
    setSuccess('');

    try {
      await api.post(
        '/rfids',
        {
          uuid: uuid.trim(),
          label: label.trim() || undefined,
          user_id: user.id,
        },
        { headers: authHeaders(token) }
      );
      setUuid('');
      setLabel('');
      setSuccess('RFID added.');
      await loadRfids();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to add RFID.'));
    }
  };

  const deleteRfid = (rfidId: number) => {
    Alert.alert('Delete RFID', 'Delete this RFID tag?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setSuccess('');
          try {
            await api.delete(`/rfids/${rfidId}`, {
              headers: authHeaders(token),
            });
            setSuccess('RFID deleted.');
            await loadRfids();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete RFID.'));
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title="Manage RFIDs">
      <View style={{ gap: 6 }}>
        <FieldLabel>Label</FieldLabel>
        <Input value={label} onChangeText={setLabel} placeholder="e.g. Main fob" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>UUID</FieldLabel>
        <Input
          accessibilityLabel="RFID identifier"
          autoCapitalize="characters"
          autoCorrect={false}
          value={uuid}
          onChangeText={setUuid}
          placeholder="Scanned RFID identifier"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {canUseScanner ? (
          <Button
            size="small"
            title="Read from scanner"
            variant="secondary"
            icon={<Feather name="wifi" size={14} color={palette.text} />}
            onPress={readTag}
            loading={reading}
          />
        ) : null}
        <Button 
          size="small" 
          title="Add RFID" 
          icon={<Feather name="plus" size={14} color="#fff" />}
          onPress={addRfid} 
          disabled={!uuid.trim()} 
        />
      </View>

      {!canUseScanner ? (
        <SubtleText>
          Only a building administrator can use the shared reader. You can still enter the tag identifier manually.
        </SubtleText>
      ) : null}

      {error && rfids.length > 0 ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}
      {reading ? <Banner type="info" text="Hold the RFID tag near the building reader. Scanning stops after 30 seconds." /> : null}

      <Divider />
      {rfids.length === 0 ? (
        <ListState
          loading={loading}
          error={error}
          emptyTitle="No RFID tags yet"
          emptyText="Scan a fob or enter its identifier to add the first tag."
          onRetry={() => void loadRfids()}
        />
      ) : (
        <View style={{ gap: 0 }}>
          {rfids.map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index === rfids.length - 1 ? 0 : 1,
                borderBottomColor: palette.canvas,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: palette.text, marginBottom: 2 }}>
                  {item.label || 'Unlabeled fob'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: palette.muted }}>
                    ...{item.last_four_digits}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.border }}>•</Text>
                  <SubtleText style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString()}</SubtleText>
                </View>
              </View>
              <Button 
                size="icon" 
                title="" 
                accessibilityLabel={`Delete RFID tag ${item.label || item.last_four_digits}`}
                variant="ghost" 
                icon={<Feather name="trash-2" size={16} color={palette.danger} />} 
                onPress={() => deleteRfid(item.id)} 
              />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};

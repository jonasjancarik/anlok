import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { RFID, User } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
} from '../common/ui';

interface RfidManagementProps {
  token: string;
  user: User;
}

export const RfidManagement = ({ token, user }: RfidManagementProps) => {
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
    <SectionCard title={`RFIDs: ${user.name}`}>
      <View style={{ gap: 6 }}>
        <FieldLabel>Label</FieldLabel>
        <Input value={label} onChangeText={setLabel} placeholder="Main fob" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>UUID</FieldLabel>
        <Input value={uuid} onChangeText={setUuid} placeholder="RFID UUID" />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Read from Scanner" onPress={readTag} loading={reading} />
        <Button title="Add RFID" onPress={addRfid} disabled={!uuid.trim()} />
      </View>

      {error ? <Banner type="error" text={error} /> : null}
      {success ? <Banner type="success" text={success} /> : null}

      <Divider />
      {rfids.length === 0 ? (
        <SubtleText>{loading ? 'Loading RFIDs...' : 'No RFID tags found.'}</SubtleText>
      ) : (
        <View style={{ gap: 8 }}>
          {rfids.map((item) => (
            <View
              key={item.id}
              style={{
                borderWidth: 1,
                borderColor: '#d2dbf0',
                borderRadius: 10,
                padding: 10,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: '700' }}>{item.label || 'Unlabeled fob'}</Text>
              <SubtleText>...{item.last_four_digits}</SubtleText>
              <SubtleText>Created: {new Date(item.created_at).toLocaleString()}</SubtleText>
              <Button title="Delete" variant="danger" onPress={() => deleteRfid(item.id)} />
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};

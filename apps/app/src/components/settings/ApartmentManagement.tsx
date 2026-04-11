import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api, apiErrorMessage, authHeaders } from '../../lib/api';
import { Apartment } from '../../types/entities';
import {
  Banner,
  Button,
  Divider,
  FieldLabel,
  Input,
  SectionCard,
  SubtleText,
} from '../common/ui';

interface ApartmentManagementProps {
  token: string;
}

export const ApartmentManagement = ({ token }: ApartmentManagementProps) => {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selected, setSelected] = useState<Apartment | null>(null);
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loadApartments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Apartment[]>('/apartments', {
        headers: authHeaders(token),
      });
      setApartments(response.data);
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to load apartments.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  const resetForm = () => {
    setSelected(null);
    setNumber('');
    setDescription('');
  };

  const saveApartment = async () => {
    setError('');
    setSuccess('');

    try {
      if (selected) {
        await api.put(
          `/apartments/${selected.id}`,
          { number: number.trim(), description: description.trim() },
          { headers: authHeaders(token) }
        );
        setSuccess('Apartment updated.');
      } else {
        await api.post(
          '/apartments',
          { number: number.trim(), description: description.trim() },
          { headers: authHeaders(token) }
        );
        setSuccess('Apartment created.');
      }

      resetForm();
      await loadApartments();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, 'Failed to save apartment.'));
    }
  };

  const editApartment = (apartment: Apartment) => {
    setSelected(apartment);
    setNumber(apartment.number);
    setDescription(apartment.description ?? '');
  };

  const removeApartment = (apartment: Apartment) => {
    Alert.alert('Delete apartment', `Delete apartment ${apartment.number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError('');
          setSuccess('');
          try {
            await api.delete(`/apartments/${apartment.id}`, {
              headers: authHeaders(token),
            });
            if (selected?.id === apartment.id) {
              resetForm();
            }
            setSuccess('Apartment deleted.');
            await loadApartments();
          } catch (nextError) {
            setError(apiErrorMessage(nextError, 'Failed to delete apartment.'));
          }
        },
      },
    ]);
  };

  return (
    <SectionCard title="Apartments">
      <View style={{ gap: 6 }}>
        <FieldLabel>Apartment Number</FieldLabel>
        <Input value={number} onChangeText={setNumber} placeholder="e.g. 3B" />
      </View>

      <View style={{ gap: 6 }}>
        <FieldLabel>Description</FieldLabel>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          title={selected ? 'Update Apartment' : 'Create Apartment'}
          onPress={saveApartment}
          disabled={!number.trim()}
        />
        {selected ? <Button title="Cancel Edit" variant="ghost" onPress={resetForm} /> : null}
      </View>

      {success ? <Banner type="success" text={success} /> : null}
      {error ? <Banner type="error" text={error} /> : null}

      <Divider />
      {apartments.length === 0 ? (
        <SubtleText>{loading ? 'Loading apartments...' : 'No apartments found.'}</SubtleText>
      ) : (
        <View style={{ gap: 8 }}>
          {apartments.map((apartment) => (
            <View
              key={apartment.id}
              style={{
                borderWidth: 1,
                borderColor: selected?.id === apartment.id ? '#1d4ed8' : '#d2dbf0',
                borderRadius: 10,
                padding: 10,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: '700' }}>Apartment {apartment.number}</Text>
              <SubtleText>{apartment.description || 'No description'}</SubtleText>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" title="Edit" variant="secondary" onPress={() => editApartment(apartment)} />
                <Button
                  size="small"
                  title="Delete"
                  variant="danger"
                  onPress={() => removeApartment(apartment)}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
};
